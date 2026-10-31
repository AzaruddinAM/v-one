<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JournalLine extends Model
{
    public $timestamps = false;

    protected $fillable = ['account_id', 'description', 'debit', 'credit'];

    protected function casts(): array
    {
        return ['debit' => 'float', 'credit' => 'float', 'account_id' => 'integer'];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
