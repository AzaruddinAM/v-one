<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'item_id', 'name', 'description', 'quantity', 'unit', 'rate', 'discount_percent',
        'tax_id', 'tax_rate', 'tax_amount', 'amount', 'sort', 'image',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'float', 'rate' => 'float', 'discount_percent' => 'float', 'tax_rate' => 'float',
            'tax_amount' => 'float', 'amount' => 'float', 'item_id' => 'integer', 'tax_id' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
