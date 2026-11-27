<?php

namespace App\Services\Ai;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Item;

/**
 * Turns what the user said ("2 LED strips at 50 and one driver", in English, Malayalam or Arabic)
 * into document lines matched to the organization's items. Uses Gemini when configured, and a
 * simple English/number parser otherwise. Nothing is saved: the lines go into the open form.
 */
class VoiceLineParser
{
    private const SYSTEM = <<<'TXT'
        You turn a spoken order into invoice / bill lines for a small business accounting app.
        The words come from speech recognition, so expect mistakes, missing punctuation and mixed languages:
        English, Malayalam (also Manglish written in Latin letters) and Arabic, including numbers said as words
        (e.g. Malayalam "randu" = 2, "anjooru" = 500, Arabic "thalatha" = 3, "khamsin" = 50, "dozen" = 12).
        For each product or service mentioned return: name (in English, as it would appear in a product list; prefer the exact
        name from the KNOWN ITEMS list when it is clearly the same thing, keep brand and model names as said),
        quantity (default 1), unit if said (pcs, kg, m, box, hrs...), and rate (price per unit) only if a price was said.
        "at 50" / "50 each" / "50 rupees each" / "@50" is a rate; "for 500 total" means rate = 500 / quantity.
        If a customer or vendor name is said ("for Ravi Stores"), return it as contact_name.
        Never invent items or prices that were not said.
        TXT;

    public function __construct(private GeminiClient $gemini) {}

    /** @return array{transcript: string, contact: ?array, contact_name: ?string, lines: array<int, array>, ai: bool} */
    public function parse(string $text, string $docType): array
    {
        $text = trim($text);
        $usedAi = $this->gemini->configured();
        $raw = $usedAi ? $this->withAi($text) : $this->simple($text);

        $priceField = in_array($docType, ['purchase_order', 'bill', 'vendor_credit'], true) ? 'purchase_price' : 'sales_price';
        $lines = collect($raw['lines'] ?? [])
            ->filter(fn ($l) => trim((string) ($l['name'] ?? '')) !== '')
            ->take(50)
            ->map(function ($l) use ($priceField) {
                $name = trim((string) $l['name']);
                $item = $this->matchItem($name);
                $qty = (float) ($l['quantity'] ?? 1);

                return [
                    'item_id' => $item?->id,
                    'name' => $item?->name ?? mb_substr($name, 0, 255),
                    'description' => $item?->description,
                    'quantity' => $qty > 0 ? round($qty, 3) : 1,
                    'unit' => ($l['unit'] ?? null) ?: $item?->unit,
                    'rate' => isset($l['rate']) && is_numeric($l['rate']) ? round((float) $l['rate'], 2) : (float) ($item?->{$priceField} ?? 0),
                    'tax_id' => $item?->tax_id,
                    'has_image' => (bool) $item?->has_image,
                    'matched' => (bool) $item,
                ];
            })->values()->all();

        $contactType = in_array($docType, Document::SALES, true) ? 'customer' : 'vendor';
        $contact = ! empty($raw['contact_name']) ? $this->matchContact((string) $raw['contact_name'], $contactType) : null;

        return [
            'transcript' => $text,
            'contact' => $contact ? $contact->only(['id', 'name', 'company_name', 'email', 'payment_terms']) : null,
            'contact_name' => $raw['contact_name'] ?? null,
            'lines' => $lines,
            'ai' => $usedAi,
        ];
    }

    private function withAi(string $text): array
    {
        $known = Item::where('is_active', true)->orderByDesc('updated_at')->limit(300)->pluck('name')->implode("\n");
        $str = ['type' => 'STRING', 'nullable' => true];
        $num = ['type' => 'NUMBER', 'nullable' => true];

        return $this->gemini->json([
            ['text' => "KNOWN ITEMS:\n".($known ?: '(none yet)')."\n\nSPOKEN ORDER:\n".$text],
        ], [
            'type' => 'OBJECT',
            'properties' => [
                'contact_name' => $str,
                'lines' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => ['name' => ['type' => 'STRING'], 'quantity' => $num, 'unit' => $str, 'rate' => $num],
                        'required' => ['name'],
                    ],
                ],
            ],
            'required' => ['lines'],
        ], self::SYSTEM);
    }

    /** Without AI: "2 LED strips at 50, 3 drivers @ 120 and one fan". Digits in Arabic and Malayalam script are understood. */
    public function simple(string $text): array
    {
        $words = ['one' => 1, 'a' => 1, 'an' => 1, 'two' => 2, 'three' => 3, 'four' => 4, 'five' => 5, 'six' => 6, 'seven' => 7,
            'eight' => 8, 'nine' => 9, 'ten' => 10, 'eleven' => 11, 'twelve' => 12, 'dozen' => 12, 'twenty' => 20];
        $digits = [];
        foreach ([0x0660, 0x06F0, 0x0D66] as $zero) { // Arabic-Indic, Persian, Malayalam
            for ($i = 0; $i < 10; $i++) {
                $digits[mb_chr($zero + $i)] = (string) $i;
            }
        }
        $text = strtr($text, $digits);

        $lines = [];
        foreach (preg_split('/\s*(?:,|;|\band\b|\bplus\b|\bthen\b|\n)\s*/iu', $text) as $part) {
            $part = trim($part, " .\t");
            if ($part === '') {
                continue;
            }
            $qty = 1;
            if (preg_match('/^(\d+(?:\.\d+)?)\s*(?:x\s*)?(.+)$/iu', $part, $m)) {
                [$qty, $part] = [(float) $m[1], $m[2]];
            } elseif (preg_match('/^(\w+)\s+(.+)$/u', $part, $m) && isset($words[mb_strtolower($m[1])])) {
                [$qty, $part] = [$words[mb_strtolower($m[1])], $m[2]];
            }
            $rate = null;
            if (preg_match('/^(.+?)\s*(?:at|@|for|rate|price)\s*(?:rs\.?|aed|dhs?)?\s*(\d+(?:\.\d+)?)\s*(?:each|rupees|dirhams?|aed|rs)?$/iu', $part, $m)) {
                [$part, $rate] = [$m[1], (float) $m[2]];
            }
            $lines[] = ['name' => trim($part), 'quantity' => $qty, 'rate' => $rate];
        }

        return ['lines' => $lines];
    }

    private function matchItem(string $name): ?Item
    {
        $lower = mb_strtolower($name);
        $singular = preg_replace('/(es|s)$/u', '', $lower);
        $q = Item::where('is_active', true);

        return (clone $q)->whereRaw('LOWER(name) = ?', [$lower])->first()
            ?? (clone $q)->whereRaw('LOWER(name) = ?', [$singular])->first()
            ?? (clone $q)->whereRaw('LOWER(sku) = ?', [$lower])->first()
            ?? (mb_strlen($singular) >= 3 ? (clone $q)->where('name', 'like', '%'.addcslashes($singular, '%_\\').'%')->orderByRaw('LENGTH(name)')->first() : null);
    }

    private function matchContact(string $name, string $type): ?Contact
    {
        $name = trim($name);
        if (mb_strlen($name) < 2) {
            return null;
        }
        $like = '%'.addcslashes($name, '%_\\').'%';
        $q = Contact::where('type', $type)->where('is_active', true);

        return (clone $q)->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
            ?? (clone $q)->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('company_name', 'like', $like))->first();
    }
}
