<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
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

    public function configured(): bool
    {
        return (string) config('services.gemini.key') !== '';
    }

    public function model(): string
    {
        return (string) config('services.gemini.model', 'gemini-2.5-flash');
    }

    /**
     * @param  array  $contents  Gemini "contents" (role + parts)
     * @param  array  $options  systemInstruction, generationConfig, tools, toolConfig
     * @return array The first candidate's content (role + parts)
     */
    public function generate(array $contents, array $options = []): array
    {
        if (! $this->configured()) {
            throw new AiException('AI assistant is not configured. Add GEMINI_API_KEY to the backend .env file.', 503);
        }

        $body = array_filter([
            'contents' => $contents,
            'systemInstruction' => isset($options['system']) ? ['parts' => [['text' => $options['system']]]] : null,
            'generationConfig' => $options['generationConfig'] ?? null,
            'tools' => $options['tools'] ?? null,
            'toolConfig' => $options['toolConfig'] ?? null,
        ]);

        try {
            $response = Http::withHeaders(['x-goog-api-key' => config('services.gemini.key')])
                ->timeout((int) config('services.gemini.timeout', 60))
                ->retry(2, 800, fn ($e) => $e instanceof ConnectionException
                    || ($e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true)), throw: false)
                ->post(self::BASE.$this->model().':generateContent', $body);
        } catch (ConnectionException $e) {
            Log::warning('Gemini connection failed', ['error' => $e->getMessage()]);
            throw new AiException('Could not reach the AI service from the server ('.Str::limit($e->getMessage(), 120).').', 502, $e);
        }

        if ($response->failed()) {
            $status = $response->status();
            // Google's error text (e.g. "API key not valid", "models/x is not found") never contains the key itself.
            $detail = Str::limit((string) ($response->json('error.message') ?? $response->body()), 200);
            Log::warning('Gemini request failed', ['status' => $status, 'body' => $detail]);
            throw new AiException(match (true) {
                $status === 429 => 'The AI service is busy (rate limit or quota reached). Please wait a moment and try again.',
                str_contains($detail, 'API key') => "The Gemini API key is invalid or missing ($detail).",
                $status === 403 => "The Gemini API key is not allowed to use this model ($detail).",
                $status === 404 => "Gemini model \"{$this->model()}\" was not found. Set GEMINI_MODEL in .env ($detail).",
                default => "The AI service returned an error ($status: $detail).",
            }, $status === 429 ? 429 : 502);
        }

        $candidate = $response->json('candidates.0');
        if (! $candidate || empty($candidate['content']['parts'])) {
            $reason = $candidate['finishReason'] ?? $response->json('promptFeedback.blockReason') ?? 'EMPTY';
            throw new AiException("The AI could not answer this request ($reason).", 422);
        }

        return $candidate['content'];
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
        ]);

        $text = self::text($content);
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new AiException('The AI response could not be read. Please try again.', 502);
        }

        return $data;
    }

    /** Concatenate the text parts of a content block. */
    public static function text(array $content): string
    {
        return trim(implode('', array_map(fn ($p) => $p['text'] ?? '', $content['parts'] ?? [])));
    }
}
