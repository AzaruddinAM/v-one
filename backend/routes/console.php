<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Recurring invoices / bills and overdue statuses. Hosting without cron still runs this
// once a day when someone opens the app (see LookupController).
Artisan::command('billing:daily', function (App\Services\RecurringService $service) {
    $created = 0;
    App\Models\Organization::query()->each(function (App\Models\Organization $org) use ($service, &$created) {
        $user = $org->users()->where('is_active', true)->orderByRaw("role = 'admin' desc")->first();
        if (! $user) {
            return;
        }
        Illuminate\Support\Facades\Auth::setUser($user);
        $created += count($service->runDue());
        $service->refreshOverdue();
    });
    $this->info("Created $created recurring document(s).");
})->purpose('Create due recurring invoices / bills and mark overdue documents');

Illuminate\Support\Facades\Schedule::command('billing:daily')->dailyAt('06:00');
