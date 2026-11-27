<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Catch N+1 queries during development.
        Model::preventLazyLoading(! $this->app->isProduction());

        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(240)->by($r->user()?->id ?: $r->ip()));
        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(5)->by(preg_replace('/\D/', '', (string) $r->input('phone')).'|'.$r->ip()),
            Limit::perMinute(20)->by($r->ip()),
        ]);
        RateLimiter::for('ai', fn (Request $r) => [
            Limit::perMinute((int) config('services.gemini.per_minute', 15))->by('ai|'.($r->user()?->id ?: $r->ip())),
            Limit::perDay((int) config('services.gemini.per_day', 500))->by('ai-org|'.($r->user()?->organization_id ?: $r->ip())),
        ]);
        RateLimiter::for('register', fn (Request $r) => Limit::perHour(10)->by($r->ip()));
        // Send by email: keeps a mistake (or a leaked token) from turning into a spam run.
        RateLimiter::for('mail', fn (Request $r) => [
            Limit::perMinute(10)->by('mail|'.($r->user()?->id ?: $r->ip())),
            Limit::perDay(300)->by('mail-org|'.($r->user()?->organization_id ?: $r->ip())),
        ]);
    }
}
