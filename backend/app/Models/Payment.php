<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use App\Models\Concerns\RespectsLockDate;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use BelongsToOrganization, HasFactory, RespectsLockDate;

    public const MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'];

    /** Mode of a payment created by applying a retainer to an invoice: no money moves. */
    public const RETAINER = 'retainer';

    protected $fillable = ['direction', 'number', 'contact_id', 'document_id', 'retainer_id', 'account_id', 'date', 'amount', 'mode', 'reference', 'notes'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'amount' => 'float', 'contact_id' => 'integer', 'document_id' => 'integer', 'account_id' => 'integer', 'retainer_id' => 'integer'];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function retainer(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'retainer_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
