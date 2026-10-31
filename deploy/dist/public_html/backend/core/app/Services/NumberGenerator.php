<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;

class NumberGenerator
{
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
}
