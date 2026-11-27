<?php

namespace App\Services;

use App\Models\Document;
use App\Models\RecurringProfile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Creates the invoices / bills that recurring profiles are due for, and keeps
 * overdue statuses current. Runs from the daily scheduler and, because shared
 * hosting often has no cron, also once a day when someone opens the app.
 */
class RecurringService
{
    /** Never create more than this many documents for one profile in one run (catch-up limit). */
    public const MAX_CATCH_UP = 24;

    public function __construct(private DocumentService $documents) {}

    /** Run for the signed-in user's organization at most once per day. */
    public function runDailyForCurrentOrganization(): void
    {
        $orgId = auth()->user()?->organization_id;
        if (! $orgId) {
            return;
        }
        Cache::remember("daily-billing:$orgId:".today()->toDateString(), now()->endOfDay(), function () {
            $this->runDue();
            $this->refreshOverdue();

            return true;
        });
    }

    /** Generate every due document for the current organization. Returns the documents created. */
    public function runDue(?RecurringProfile $only = null): array
    {
        $created = [];
        $profiles = $only ? collect([$only]) : RecurringProfile::where('status', 'active')
            ->whereDate('next_date', '<=', today())->get();

        foreach ($profiles as $profile) {
            $count = 0;
            while ($profile->status === 'active' && $profile->next_date->lte(today()) && $count < self::MAX_CATCH_UP) {
                if ($profile->end_date && $profile->next_date->gt($profile->end_date)) {
                    $profile->status = 'expired';
                    break;
                }
                $created[] = $this->generate($profile, $profile->next_date->copy());
                $profile->next_date = $profile->advance($profile->next_date);
                $count++;
            }
            if ($profile->end_date && $profile->next_date->gt($profile->end_date)) {
                $profile->status = 'expired';
            }
            $profile->save();
        }

        return $created;
    }

    /** Create one document from the profile's template, dated $date. */
    public function generate(RecurringProfile $profile, Carbon $date): Document
    {
        return DB::transaction(function () use ($profile, $date) {
            $t = $profile->template ?? [];
            $terms = $profile->payment_terms;
            $due = Document::dueDateFor($terms, $date->toDateString())
                ?? $date->copy()->addDays($profile->contact?->payment_terms ?? 30)->toDateString();

            $doc = $this->documents->save([
                'type' => $profile->type,
                'contact_id' => $profile->contact_id,
                'date' => $date->toDateString(),
                'due_date' => $due,
                'payment_terms' => $terms,
                'status' => $profile->auto_send ? ($profile->type === 'invoice' ? 'sent' : 'open') : 'draft',
                'reference' => $t['reference'] ?? null,
                'discount' => $t['discount'] ?? 0,
                'adjustment' => $t['adjustment'] ?? 0,
                'notes' => $t['notes'] ?? null,
                'terms' => $t['terms'] ?? null,
                'recurring_profile_id' => $profile->id,
                'items' => $t['items'] ?? [],
            ]);

            $profile->generated_count++;
            $profile->last_generated_at = now();

            return $doc;
        });
    }

    /** Mark unpaid sent invoices / open bills whose due date has passed as overdue. */
    public function refreshOverdue(): int
    {
        return Document::whereIn('type', ['invoice', 'bill'])->whereIn('status', ['sent', 'open'])
            ->where('balance', '>', 0)->whereNotNull('due_date')->whereDate('due_date', '<', today())
            ->update(['status' => 'overdue']);
    }
}
