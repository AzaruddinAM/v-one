<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contact extends Model
{
    use BelongsToOrganization, HasFactory;

    protected $fillable = [
        'type', 'name', 'company_name', 'code', 'email', 'phone', 'gstin', 'pan', 'billing_address',
        'shipping_address', 'city', 'state', 'country', 'pincode', 'opening_balance',
        'payment_terms', 'notes', 'is_active',
    ];

    protected function casts(): array
    {
        return ['opening_balance' => 'float', 'payment_terms' => 'integer', 'is_active' => 'boolean', 'outstanding' => 'float'];
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
