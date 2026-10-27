<?php

namespace App\Http\Controllers;

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

    /** Apply ?sort=field or ?sort=-field restricted to an allow-list. */
    protected function sort(Builder $query, Request $request, array $allowed, string $default = '-id'): Builder
    {
        $sort = (string) $request->input('sort', $default);
        $dir = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $field = ltrim($sort, '-');
        if (! in_array($field, $allowed, true)) {
            $field = ltrim($default, '-');
            $dir = str_starts_with($default, '-') ? 'desc' : 'asc';
        }

        return $query->orderBy($query->getModel()->getTable().'.'.$field, $dir);
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
