<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use BelongsToOrganization, HasFactory;

    protected $fillable = ['date', 'account_id', 'paid_through_id', 'contact_id', 'amount', 'tax_id', 'tax_amount', 'total', 'reference', 'description'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d', 'amount' => 'float', 'tax_amount' => 'float', 'total' => 'float',
            'account_id' => 'integer', 'paid_through_id' => 'integer', 'contact_id' => 'integer', 'tax_id' => 'integer',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function paidThrough(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'paid_through_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function tax(): BelongsTo
    {
        return $this->belongsTo(Tax::class);
    }
}
