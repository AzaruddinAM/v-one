<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/** A schedule that creates an invoice or bill from a saved template every week / month / year. */
class RecurringProfile extends Model
{
    use BelongsToOrganization;

    public const TYPES = ['invoice', 'bill'];

    public const FREQUENCIES = ['week', 'month', 'year'];

    protected $fillable = [
        'type', 'name', 'contact_id', 'frequency', 'interval', 'start_date', 'end_date', 'next_date',
        'status', 'auto_send', 'payment_terms', 'template', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d', 'end_date' => 'date:Y-m-d', 'next_date' => 'date:Y-m-d',
            'auto_send' => 'boolean', 'template' => 'array', 'interval' => 'integer',
            'generated_count' => 'integer', 'last_generated_at' => 'datetime', 'contact_id' => 'integer',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    /** The run date after $from for this profile's frequency. */
    public function advance(Carbon $from): Carbon
    {
        $n = max(1, $this->interval);

        return match ($this->frequency) {
            'week' => $from->copy()->addWeeks($n),
            'year' => $from->copy()->addYearsNoOverflow($n),
            default => $from->copy()->addMonthsNoOverflow($n),
        };
    }
}
