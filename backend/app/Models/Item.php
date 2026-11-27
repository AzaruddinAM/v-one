<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Item extends Model
{
    use BelongsToOrganization, HasFactory;

    protected $fillable = [
        'name', 'sku', 'type', 'unit', 'hsn_code', 'category', 'description', 'sales_price',
        'purchase_price', 'tax_id', 'track_inventory', 'stock_on_hand', 'reorder_level', 'is_active', 'image',
    ];

    /** The photo is only sent when one item is opened (GET items/{id}); lists get has_image instead. */
    protected $hidden = ['image'];

    protected $appends = ['has_image'];

    public function getHasImageAttribute(): bool
    {
        return ! empty($this->attributes['image'] ?? null);
    }

    protected function casts(): array
    {
        return [
            'sales_price' => 'float', 'purchase_price' => 'float', 'stock_on_hand' => 'float',
            'reorder_level' => 'float', 'track_inventory' => 'boolean', 'is_active' => 'boolean',
            'tax_id' => 'integer',
        ];
    }

    public function tax(): BelongsTo
    {
        return $this->belongsTo(Tax::class);
    }
}
