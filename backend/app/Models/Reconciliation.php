<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A bank or cash account matched against a statement: the ticked entries are stored as reconciled_entries. */
class Reconciliation extends Model
{
    use BelongsToOrganization;

    protected $fillable = ['account_id', 'statement_date', 'statement_balance', 'cleared_balance', 'entries_count', 'created_by'];

    protected function casts(): array
    {
        return ['statement_date' => 'date:Y-m-d', 'statement_balance' => 'float', 'cleared_balance' => 'float',
            'entries_count' => 'integer', 'account_id' => 'integer'];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(ReconciledEntry::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
