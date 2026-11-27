<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/** Transaction locking: nothing dated on or before the organization's lock date may be added, changed or deleted. */
class LockDate
{
    public static function current(): ?Carbon
    {
        $d = auth()->user()?->organization?->lock_date;

        return $d ? Carbon::parse($d)->startOfDay() : null;
    }

    public static function assertOpen(mixed ...$dates): void
    {
        $lock = self::current();
        if (! $lock) {
            return;
        }
        foreach ($dates as $date) {
            if ($date && Carbon::parse($date)->startOfDay()->lte($lock)) {
                throw ValidationException::withMessages([
                    'date' => 'Transactions up to '.$lock->format('d M Y').' are locked. Unlock them in Settings → Transaction locking first.',
                ]);
            }
        }
    }
}
