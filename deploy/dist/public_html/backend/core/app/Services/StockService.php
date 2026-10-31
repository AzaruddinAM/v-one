<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Item;
use App\Models\StockMovement;

class StockService
{
    /** Re-sync stock movements of a document (idempotent). */
    public function syncDocument(Document $document): void
    {
        $this->reverseDocument($document);

        $direction = $document->stockDirection();
        if ($direction === 0) {
            return;
        }

        $document->loadMissing('items.item');
        foreach ($document->items as $line) {
            $item = $line->item;
            if (! $item || ! $item->track_inventory || $item->type !== 'goods') {
                continue;
            }
            $qty = $direction * $line->quantity;
            StockMovement::create([
                'organization_id' => $document->organization_id,
                'item_id' => $item->id,
                'document_id' => $document->id,
                'type' => $document->type,
                'quantity' => $qty,
                'date' => $document->date,
            ]);
            $item->increment('stock_on_hand', $qty);
        }
    }

    public function reverseDocument(Document $document): void
    {
        StockMovement::where('document_id', $document->id)->get()->each(function (StockMovement $m) {
            Item::whereKey($m->item_id)->decrement('stock_on_hand', $m->quantity);
            $m->delete();
        });
    }

    public function adjust(Item $item, float $quantity, string $date, ?string $notes = null): StockMovement
    {
        $movement = StockMovement::create([
            'organization_id' => $item->organization_id,
            'item_id' => $item->id,
            'type' => 'adjustment',
            'quantity' => $quantity,
            'date' => $date,
            'notes' => $notes,
        ]);
        $item->increment('stock_on_hand', $quantity);

        return $movement;
    }
}
