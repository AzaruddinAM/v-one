<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Minimal Google Gemini REST client (generateContent).
 * The API key stays on the server — the browser never sees it.
 */
class GeminiClient
{
    private const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

    /** Tried in order when the configured model is unavailable for the key. */
    private const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

    private ?string $workingModel = null;

    public function configured(): bool
    {
        return $this->key() !== '';
    }

    public function model(): string
    {
        return $this->workingModel ?? $this->configuredModel();
    }

    private function configuredModel(): string
    {
        return trim((string) config('services.gemini.model', 'gemini-2.5-flash'), " \t\r\n\"'") ?: 'gemini-2.5-flash';
    }

    /** Tolerates keys pasted into .env with quotes, spaces or Windows line endings. */
    private function key(): string
    {
        return trim((string) config('services.gemini.key'), " \t\r\n\"'");
    }

    /**
     * @param  array  $contents  Gemini "contents" (role + parts)
     * @param  array  $options  systemInstruction, generationConfig, tools, toolConfig
     * @return array The first candidate's content (role + parts)
     */
    public function generate(array $contents, array $options = []): array
    {
        if (! $this->configured()) {
            throw new AiException('AI assistant is not configured. Add GEMINI_API_KEY to the backend .env file.', 422);
        }

        $models = $this->workingModel ? [$this->workingModel] : array_values(array_unique([$this->configuredModel(), ...self::FALLBACK_MODELS]));

        foreach ($models as $i => $model) {
            $response = $this->send($model, $contents, $options);
            if ($response->successful()) {
                $this->workingModel = $model;
                break;
            }
            $status = $response->status();
            // Google's error text (e.g. "API key not valid", "models/x is not found") never contains the key itself.
            $detail = Str::limit((string) ($response->json('error.message') ?? $response->body()), 200);
            Log::warning('Gemini request failed', ['model' => $model, 'status' => $status, 'body' => $detail]);

            $modelProblem = in_array($status, [403, 404], true)
                || ($status === 400 && preg_match('/model|not supported|thinking/i', $detail) && ! str_contains($detail, 'API key'));
            if ($modelProblem && $i < count($models) - 1) {
                continue; // try the next model
            }

            // Upstream failures are answered with 422 / 429 — hosting proxies replace 502/503 bodies with their own error page.
            throw new AiException(match (true) {
                $status === 429 => 'The AI service is busy (rate limit or free quota reached). Please wait a minute and try again.',
                str_contains($detail, 'API key') => "The Gemini API key is not valid. Copy it again from aistudio.google.com/apikey into GEMINI_API_KEY ($detail).",
                $status === 403 => "This Gemini API key is not allowed to use the model ($detail).",
                $status === 404 => "Gemini model \"$model\" was not found. Set GEMINI_MODEL in .env ($detail).",
                default => "The AI service returned an error ($status: $detail).",
            }, $status === 429 ? 429 : 422);
        }

        $candidate = $response->json('candidates.0');
        if (! $candidate || empty($candidate['content']['parts'])) {
            $reason = $candidate['finishReason'] ?? $response->json('promptFeedback.blockReason') ?? 'EMPTY';
            throw new AiException("The AI could not answer this request ($reason).", 422);
        }

        return $candidate['content'];
    }

    private function send(string $model, array $contents, array $options): Response
    {
        $config = $options['generationConfig'] ?? [];
        // 2.5 models "think" before answering by default, which makes replies slow enough for shared hosting to time out.
        if (str_starts_with($model, 'gemini-2.5')) {
            $config['thinkingConfig'] = ['thinkingBudget' => $options['thinkingBudget'] ?? 0];
        }

        $body = array_filter([
            'contents' => $contents,
            'systemInstruction' => isset($options['system']) ? ['parts' => [['text' => $options['system']]]] : null,
            'generationConfig' => $config ?: null,
            'tools' => $options['tools'] ?? null,
            'toolConfig' => $options['toolConfig'] ?? null,
        ]);

        try {
            return Http::withHeaders(['x-goog-api-key' => $this->key()])
                ->connectTimeout(10)
                ->timeout((int) config('services.gemini.timeout', 30))
                ->retry(2, 1000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true), throw: false)
                ->post(self::BASE.$model.':generateContent', $body);
        } catch (ConnectionException $e) {
            Log::warning('Gemini connection failed', ['error' => $e->getMessage()]);
            throw new AiException('The server could not reach Google Gemini ('.Str::limit($e->getMessage(), 140).'). Your host may block outgoing connections — ask Hostinger support to allow generativelanguage.googleapis.com.', 422, $e);
        }
    }

    /** Ask for JSON that follows a response schema and decode it. */
    public function json(array $parts, array $schema, string $system): array
    {
        $content = $this->generate([['role' => 'user', 'parts' => $parts]], [
            'system' => $system,
            'generationConfig' => [
                'temperature' => 0.1,
                'responseMimeType' => 'application/json',
                'responseSchema' => $schema,
            ],
            // A little reasoning helps with messy bills (tax-inclusive prices, DD/MM dates).
            'thinkingBudget' => 512,
        ]);

        $text = self::text($content);
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new AiException('The AI response could not be read. Please try again.', 422);
        }

        return $data;
    }

    /** Concatenate the text parts of a content block. */
    public static function text(array $content): string
    {
        return trim(implode('', array_map(fn ($p) => $p['text'] ?? '', $content['parts'] ?? [])));
    }
}
