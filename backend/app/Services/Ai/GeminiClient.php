<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
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

    public const DEFAULT_MODEL = 'gemini-3.5-flash';

    /**
     * Tried in order when the configured model is unavailable for the key (Google retires
     * older models for new keys). The "-latest" aliases always point at a current model.
     */
    private const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash'];

    private ?string $workingModel = null;

    private ?float $deadline = null;

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
        return trim((string) config('services.gemini.model', self::DEFAULT_MODEL), " \t\r\n\"'") ?: self::DEFAULT_MODEL;
    }

    /** The model that last worked for this key is remembered, so later requests skip retired ones. */
    private function cacheKey(): string
    {
        return 'gemini.working-model.'.md5($this->key().'|'.$this->configuredModel());
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

        $this->workingModel ??= Cache::get($this->cacheKey());
        $models = array_values(array_unique(array_filter([$this->workingModel, $this->configuredModel(), ...self::FALLBACK_MODELS])));
        $tried = [];
        $sawBusy = false;

        // One time budget for the whole HTTP request (a chat answer may need several Gemini calls),
        // so we always answer before the hosting proxy gives up and shows its own 502/504 page.
        $this->deadline ??= microtime(true) + (int) config('services.gemini.deadline', 55);

        foreach ($models as $i => $model) {
            if ($this->deadline - microtime(true) < 5) {
                throw new AiException("Google's Gemini servers are responding too slowly right now (tried ".implode(', ', $tried ?: [$model]).'). Please try again in a minute.', 422);
            }
            $tried[] = $model;
            $response = $this->send($model, $contents, $options, thinking: true);
            if ($response?->status() === 400 && preg_match('/thinking/i', (string) $response->json('error.message'))) {
                $response = $this->send($model, $contents, $options, thinking: false);
            }
            if ($response === null) {
                // Connected, but no answer in time: the model is overloaded — a lighter one is usually faster.
                $sawBusy = true;
                if ($i < count($models) - 1) {
                    continue;
                }
                throw new AiException("Google's Gemini servers are responding too slowly right now (tried ".implode(', ', $tried).'). Please try again in a minute.', 422);
            }
            if ($response->successful()) {
                if ($this->workingModel !== $model) {
                    $this->workingModel = $model;
                    Cache::put($this->cacheKey(), $model, now()->addDay());
                }
                break;
            }
            $status = $response->status();
            // Google's error text (e.g. "API key not valid", "models/x is not found") never contains the key itself.
            $detail = Str::limit((string) ($response->json('error.message') ?? $response->body()), 200);
            Log::warning('Gemini request failed', ['model' => $model, 'status' => $status, 'body' => $detail]);

            $modelProblem = in_array($status, [403, 404], true)
                || ($status === 400 && preg_match('/model|not supported|no longer available/i', $detail) && ! str_contains($detail, 'API key'));
            if ($modelProblem && $model === $this->workingModel) {
                $this->workingModel = null;
                Cache::forget($this->cacheKey());
            }
            // Overload and quota limits are per model, so another model often still answers.
            $busy = in_array($status, [429, 500, 503], true) || preg_match('/high demand|overloaded|unavailable/i', $detail);
            $sawBusy = $sawBusy || $busy;
            if (($modelProblem || $busy) && $i < count($models) - 1) {
                continue; // try the next model
            }

            // Upstream failures are answered with 422 / 429 — hosting proxies replace 502/503 bodies with their own error page.
            throw new AiException(match (true) {
                $sawBusy && $status !== 429 => "Google's Gemini servers are very busy right now (tried ".implode(', ', $tried).'). Please try again in a minute.',
                $status === 429 => 'The AI free quota or rate limit is used up for now (tried '.implode(', ', $tried).'). Please wait a minute and try again.',
                str_contains($detail, 'API key') => "The Gemini API key is not valid. Copy it again from aistudio.google.com/apikey into GEMINI_API_KEY ($detail).",
                $modelProblem => 'None of these Gemini models is available for this API key: '.implode(', ', $tried).". Set GEMINI_MODEL in .env to a current model from ai.google.dev/gemini-api/docs/models ($detail).",
                default => "The AI service returned an error ($status: $detail).",
            }, $status === 429 ? 429 : 422);
        }

        $candidate = $response->json('candidates.0');
        if (! $candidate || empty($candidate['content']['parts'])) {
            $reason = $candidate['finishReason'] ?? $response->json('promptFeedback.blockReason') ?? 'EMPTY';
            throw new AiException("The AI could not answer this request ($reason).", 422);
        }

        // PHP decodes an empty JSON object ({}) to [], which would be sent back as a list — Gemini rejects that.
        $content = $candidate['content'];
        foreach ($content['parts'] as &$part) {
            if (isset($part['functionCall']) && empty($part['functionCall']['args'])) {
                $part['functionCall']['args'] = new \stdClass;
            }
        }
        unset($part);

        return $content;
    }

    /** @return Response|null null when the connection worked but Gemini did not answer in time */
    private function send(string $model, array $contents, array $options, bool $thinking): ?Response
    {
        $config = $options['generationConfig'] ?? [];
        // Newer models "think" before answering by default, which makes replies slow enough for shared hosting to time out.
        if ($thinking && str_starts_with($model, 'gemini-2.5')) {
            $config['thinkingConfig'] = ['thinkingBudget' => $options['thinkingBudget'] ?? 0];
        } elseif ($thinking && preg_match('/^gemini-[3-9]/', $model)) {
            $config['thinkingConfig'] = ['thinkingLevel' => ($options['thinkingBudget'] ?? 0) > 0 ? 'medium' : 'low'];
        }

        $body = array_filter([
            'contents' => $contents,
            'systemInstruction' => isset($options['system']) ? ['parts' => [['text' => $options['system']]]] : null,
            'generationConfig' => $config ?: null,
            'tools' => $options['tools'] ?? null,
            'toolConfig' => $options['toolConfig'] ?? null,
        ]);

        $remaining = (int) floor($this->deadline - microtime(true));

        try {
            return Http::withHeaders(['x-goog-api-key' => $this->key()])
                ->connectTimeout(10)
                ->timeout(max(5, min((int) config('services.gemini.timeout', 25), $remaining)))
                ->retry(2, 1000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true), throw: false)
                ->post(self::BASE.$model.':generateContent', $body);
        } catch (ConnectionException $e) {
            Log::warning('Gemini connection failed', ['model' => $model, 'error' => $e->getMessage()]);
            // cURL 28 after connecting ("… with N bytes received") = slow answer, not a blocked connection.
            if (preg_match('/cURL error 28/i', $e->getMessage()) && str_contains($e->getMessage(), 'bytes received')) {
                return null;
            }
            throw new AiException('The server could not connect to Google Gemini ('.Str::limit($e->getMessage(), 140).'). If this keeps happening, ask Hostinger support to allow outgoing HTTPS to generativelanguage.googleapis.com.', 422, $e);
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
