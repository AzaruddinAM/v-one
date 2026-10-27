<?php

namespace App\Support;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Rules\Unique;

/** Validation helpers that keep lookups inside the current organization. */
class Tenant
{
    public static function id(): ?int
    {
        return auth()->user()?->organization_id;
    }

    public static function exists(string $table, string $column = 'id'): Exists
    {
        return Rule::exists($table, $column)->where('organization_id', self::id());
    }

    public static function unique(string $table, string $column, ?int $ignoreId = null): Unique
    {
        $rule = Rule::unique($table, $column)->where('organization_id', self::id());

        return $ignoreId ? $rule->ignore($ignoreId) : $rule;
    }
}
