<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

abstract class Controller
{
    /** Paginate with a sane, bounded page size. */
    protected function paginate(Builder $query, Request $request)
    {
        $perPage = max(1, min(100, (int) $request->input('per_page', 20)));

        return $query->paginate($perPage)->withQueryString();
    }

    /**
     * Apply ?sort=field or ?sort=-field restricted to an allow-list.
     * $custom: field => fn (Builder $q, string $dir) for sorts that are not a plain column
     * (a related name, a withSum alias…). Custom fields are allowed automatically.
     */
    protected function sort(Builder $query, Request $request, array $allowed, string $default = '-id', array $custom = []): Builder
    {
        $sort = (string) $request->input('sort', $default);
        $dir = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $field = ltrim($sort, '-');
        if (! in_array($field, $allowed, true) && ! isset($custom[$field])) {
            $field = ltrim($default, '-');
            $dir = str_starts_with($default, '-') ? 'desc' : 'asc';
        }
        if (isset($custom[$field])) {
            $custom[$field]($query, $dir);

            return $query;
        }

        return $query->orderBy($query->getModel()->getTable().'.'.$field, $dir);
    }

    /**
     * Column filters typed into list table headers, sent as ?f_<key>=value.
     * $map: key => [column, op] with op like|eq|min|max|from|to, or key => fn (Builder $q, string $value).
     * A value that doesn't fit its operator (text in an amount box) is ignored rather than rejected.
     */
    protected function columnFilters(Builder $query, Request $request, array $map): Builder
    {
        foreach ($map as $key => $rule) {
            $value = $request->query('f_'.$key);
            if (! is_scalar($value) || trim((string) $value) === '') {
                continue;
            }
            $value = mb_substr(trim((string) $value), 0, 100);
            if ($rule instanceof Closure) {
                $rule($query, $value);

                continue;
            }
            [$column, $op] = $rule;
            $isDate = (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
            match ($op) {
                'like' => $query->where($column, 'like', static::like($value)),
                'eq' => $query->where($column, $value),
                'min' => is_numeric($value) ? $query->where($column, '>=', (float) $value) : null,
                'max' => is_numeric($value) ? $query->where($column, '<=', (float) $value) : null,
                'from' => $isDate ? $query->whereDate($column, '>=', $value) : null,
                'to' => $isDate ? $query->whereDate($column, '<=', $value) : null,
            };
        }

        return $query;
    }

    /** Filter on a related model's column, e.g. the customer's name. */
    protected static function whereRelated(string $relation, string|array $columns): Closure
    {
        return fn (Builder $q, string $v) => $q->whereHas($relation, fn ($r) => $r->where(function ($w) use ($columns, $v) {
            foreach ((array) $columns as $c) {
                $w->orWhere($c, 'like', static::like($v));
            }
        }));
    }

    /** Filter where any of several columns contains the value. */
    protected static function whereAny(array $columns): Closure
    {
        return fn (Builder $q, string $v) => $q->where(function ($w) use ($columns, $v) {
            foreach ($columns as $c) {
                $w->orWhere($c, 'like', static::like($v));
            }
        });
    }

    /** Order by a column of a belongsTo relation (e.g. contacts.name) without changing the selected columns. */
    protected static function orderByRelated(string $table, string $foreignKey, string $column): Closure
    {
        return fn (Builder $q, string $dir) => $q->orderBy(
            \Illuminate\Support\Facades\DB::table($table)->select($column)->whereColumn("$table.id", $q->getModel()->getTable().'.'.$foreignKey)->limit(1),
            $dir,
        );
    }

    /** %term% for a LIKE query with the wildcards in the term escaped. */
    protected static function like(string $term): string
    {
        return '%'.addcslashes($term, '%_\\').'%';
    }

    protected function search(Builder $query, ?string $term, array $columns): Builder
    {
        $term = trim((string) $term);
        if ($term === '') {
            return $query;
        }

        return $query->where(function ($q) use ($term, $columns) {
            foreach ($columns as $c) {
                $q->orWhere($c, 'like', '%'.addcslashes($term, '%_').'%');
            }
        });
    }
}
