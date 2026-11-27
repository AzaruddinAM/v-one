<?php

namespace App\Models\Concerns;

use App\Support\LockDate;

/**
 * Blocks creating, changing or deleting a dated record inside the locked period.
 * Changes limited to $lockIgnored attributes (e.g. payment status, balances) are allowed.
 */
trait RespectsLockDate
{
    public static function bootRespectsLockDate(): void
    {
        static::saving(function ($model) {
            if (! $model->exists) {
                LockDate::assertOpen($model->date);

                return;
            }
            $ignored = property_exists($model, 'lockIgnored') ? $model->lockIgnored : [];
            if (array_diff(array_keys($model->getDirty()), $ignored, ['updated_at'])) {
                LockDate::assertOpen($model->getOriginal('date'), $model->date);
            }
        });
        static::deleting(fn ($model) => LockDate::assertOpen($model->getOriginal('date')));
    }
}
