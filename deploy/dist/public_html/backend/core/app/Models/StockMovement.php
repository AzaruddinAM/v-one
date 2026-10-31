<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use BelongsToOrganization;

    protected $fillable = ['organization_id', 'item_id', 'document_id', 'type', 'quantity', 'date', 'notes'];

    protected function casts(): array
    {
        return ['quantity' => 'float', 'date' => 'date:Y-m-d', 'item_id' => 'integer'];
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
