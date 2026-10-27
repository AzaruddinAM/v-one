<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use BelongsToOrganization, HasFactory;

    public const MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'];

    protected $fillable = ['direction', 'number', 'contact_id', 'document_id', 'account_id', 'date', 'amount', 'mode', 'reference', 'notes'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'amount' => 'float', 'contact_id' => 'integer', 'document_id' => 'integer', 'account_id' => 'integer'];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
