<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class NumberGenerator
{
    /** Placeholders allowed in a custom prefix, e.g. "INV-{YY}-{CODE}-". */
    public const TOKENS = ['{YYYY}', '{YY}', '{MM}', '{FY}', '{CODE}'];

    /**
     * Next sequential number for a scoped query, e.g. INV-00001.
     * Reads the numeric suffix of the latest records so manual numbers don't break the sequence.
     */
    public static function next(Builder $query, string $prefix, string $column = 'number'): string
    {
        $max = 0;
        $query->where($column, 'like', $prefix.'%')
            ->orderByDesc('id')->limit(50)->pluck($column)
            ->each(function ($n) use (&$max, $prefix) {
                $num = (int) preg_replace('/\D/', '', substr($n, strlen($prefix)));
                $max = max($max, $num);
            });

        return $prefix.str_pad((string) ($max + 1), 5, '0', STR_PAD_LEFT);
    }

    /** The organization's custom series for a document type, or null to use the default INV-00001 style. */
    public static function series(?Organization $org, string $type): ?array
    {
        $s = $org?->number_series[$type] ?? null;

        return is_array($s) && trim((string) ($s['prefix'] ?? '')) !== '' ? [
            'prefix' => (string) $s['prefix'],
            'next' => max(1, (int) ($s['next'] ?? 1)),
            'digits' => min(10, max(1, (int) ($s['digits'] ?? 5))),
        ] : null;
    }

    /** Expand the placeholders of a prefix for a document date and contact. */
    public static function renderPrefix(string $prefix, ?string $date = null, ?Contact $contact = null, int $fyStartMonth = 4): string
    {
        $d = Carbon::parse($date ?: today());
        $fyStart = $d->month >= $fyStartMonth ? $d->year : $d->year - 1;
        $fy = $fyStartMonth === 1 ? $d->format('y') : substr((string) $fyStart, 2).'-'.substr((string) ($fyStart + 1), 2);

        return strtr($prefix, [
            '{YYYY}' => $d->format('Y'),
            '{YY}' => $d->format('y'),
            '{MM}' => $d->format('m'),
            '{FY}' => $fy,
            '{CODE}' => self::contactCode($contact),
        ]);
    }

    /** Contact short code, or initials of the first two words ("Design Infinity LLC" → "DI"). */
    public static function contactCode(?Contact $contact): string
    {
        if (! $contact) {
            return 'XX';
        }
        if ($contact->code) {
            return strtoupper($contact->code);
        }
        $words = preg_split('/[^A-Za-z0-9]+/', (string) ($contact->company_name ?: $contact->name), -1, PREG_SPLIT_NO_EMPTY);

        return strtoupper(implode('', array_map(fn ($w) => $w[0], array_slice($words, 0, 2)))) ?: 'XX';
    }

    /**
     * Number for a new document. With a custom series the running number is shared by all
     * prefixes of the type (INV-26-TU-2630, INV-26-ID-2631 …). $reserve advances the counter.
     */
    public static function forDocument(string $type, ?Contact $contact = null, ?string $date = null, bool $reserve = false): string
    {
        $org = auth()->user()?->organization;
        $series = self::series($org, $type);
        if (! $series) {
            return self::next(Document::where('type', $type), Document::PREFIX[$type]);
        }

        if ($reserve) {
            $org = Organization::whereKey($org->id)->lockForUpdate()->first();
            $series = self::series($org, $type);
        }
        $prefix = self::renderPrefix($series['prefix'], $date, $contact, (int) ($org->fiscal_year_start ?: 4));
        $n = $series['next'];
        do {
            $number = $prefix.str_pad((string) $n, $series['digits'], '0', STR_PAD_LEFT);
            $taken = Document::where('type', $type)->where('number', $number)->exists();
            $n++;
        } while ($taken && $n < $series['next'] + 1000);

        if ($reserve) {
            self::storeNext($org, $type, $n);
        }

        return $number;
    }

    /**
     * After a document is saved with a hand-typed number that follows the series
     * (e.g. imported INV-26-TU-2630), continue the counter after it.
     */
    public static function noteManual(string $type, string $number, ?Contact $contact, ?string $date): void
    {
        $org = auth()->user()?->organization;
        $series = self::series($org, $type);
        if (! $series) {
            return;
        }
        $prefix = self::renderPrefix($series['prefix'], $date, $contact, (int) ($org->fiscal_year_start ?: 4));
        if (! str_starts_with($number, $prefix) || ! ctype_digit($rest = substr($number, strlen($prefix)))) {
            return;
        }
        if ((int) $rest >= $series['next']) {
            self::storeNext(Organization::whereKey($org->id)->lockForUpdate()->first(), $type, (int) $rest + 1);
        }
    }

    private static function storeNext(Organization $org, string $type, int $next): void
    {
        $all = $org->number_series ?? [];
        $all[$type]['next'] = max($next, (int) ($all[$type]['next'] ?? 1));
        $org->number_series = $all;
        $org->save();
        auth()->user()?->setRelation('organization', $org);
    }
}
