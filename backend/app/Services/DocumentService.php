<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Payment;
use App\Models\Tax;
use Illuminate\Support\Facades\DB;

class DocumentService
{
    public function __construct(private StockService $stock) {}

    /** Create or update a document together with its line items, inside a transaction. */
    public function save(array $data, ?Document $document = null): Document
    {
        return DB::transaction(function () use ($data, $document) {
            $taxRates = Tax::whereIn('id', collect($data['items'])->pluck('tax_id')->filter()->unique())
                ->pluck('rate', 'id');

            $lines = collect($data['items'])->values()->map(function ($l, $i) use ($taxRates) {
                $l['tax_rate'] = ! empty($l['tax_id']) ? (float) ($taxRates[$l['tax_id']] ?? 0) : 0;
                $l['sort'] = $i;

                return $l;
            })->all();

            $calc = DocumentCalculator::calculate($lines, (float) ($data['discount'] ?? 0), (float) ($data['adjustment'] ?? 0));

            $attrs = array_merge(
                collect($data)->except('items')->all(),
                collect($calc)->except('lines')->all(),
            );

            if (! empty($attrs['payment_terms']) && empty($attrs['due_date'])) {
                $attrs['due_date'] = Document::dueDateFor($attrs['payment_terms'], $attrs['date'] ?? $document?->date?->toDateString() ?? today()->toDateString());
            }

            if ($document) {
                $document->fill($attrs);
            } else {
                $contact = Contact::find($attrs['contact_id'] ?? null);
                if (empty($attrs['number'])) {
                    $attrs['number'] = NumberGenerator::forDocument($attrs['type'], $contact, $attrs['date'] ?? null, reserve: true);
                } else {
                    NumberGenerator::noteManual($attrs['type'], $attrs['number'], $contact, $attrs['date'] ?? null);
                }
                $attrs['created_by'] = auth()->id();
                $document = new Document($attrs);
            }
            $document->save();

            $document->items()->delete();
            $document->items()->createMany(collect($calc['lines'])->map(fn ($l) => collect($l)->only([
                'item_id', 'name', 'description', 'quantity', 'unit', 'rate', 'discount_percent',
                'tax_id', 'tax_rate', 'tax_amount', 'amount', 'sort',
            ])->all())->all());

            $this->refreshPaymentStatus($document);
            $this->stock->syncDocument($document->fresh('items.item'));

            return $document->fresh(['contact', 'items']);
        });
    }

    /** Recalculate paid amount, balance and payment-driven status. */
    public function refreshPaymentStatus(Document $document): Document
    {
        $paid = $document->isPayable() ? (float) Payment::where('document_id', $document->id)->sum('amount') : 0.0;
        $document->amount_paid = round($paid, 2);
        $document->balance = $document->isPayable() ? round(max(0, $document->total - $paid), 2) : 0;

        if ($document->isPayable() && ! in_array($document->status, ['draft', 'void'], true)) {
            $base = $document->type === 'invoice' ? 'sent' : 'open';
            if ($document->total > 0 && $document->balance <= 0) {
                $document->status = 'paid';
            } elseif ($paid > 0) {
                $document->status = 'partial';
            } elseif ($document->due_date && $document->due_date->lt(today())) {
                $document->status = 'overdue';
            } else {
                $document->status = $base;
            }
        }
        $document->save();

        return $document;
    }

    public function changeStatus(Document $document, string $status): Document
    {
        return DB::transaction(function () use ($document, $status) {
            $document->status = $status;
            $this->refreshPaymentStatus($document);
            $this->stock->syncDocument($document);

            return $document->fresh(['contact', 'items']);
        });
    }

    /** Convert estimate / sales order / delivery challan → invoice, purchase order → bill. */
    public function convert(Document $source, string $to): Document
    {
        $data = [
            'type' => $to,
            'contact_id' => $source->contact_id,
            'date' => today()->toDateString(),
            'due_date' => today()->addDays($source->contact->payment_terms ?? 30)->toDateString(),
            'payment_terms' => $source->payment_terms,
            'status' => 'draft',
            'reference' => $source->number,
            'discount' => $source->discount,
            'adjustment' => $source->adjustment,
            'notes' => $source->notes,
            'terms' => $source->terms,
            'converted_from_id' => $source->id,
            'items' => $source->items->map(fn ($l) => $l->only([
                'item_id', 'name', 'description', 'quantity', 'unit', 'rate', 'discount_percent', 'tax_id',
            ]))->all(),
        ];

        return DB::transaction(function () use ($source, $data, $to) {
            $doc = $this->save($data);
            $source->update(['status' => match ($source->type) {
                'estimate' => 'accepted',
                'delivery_challan' => 'invoiced',
                default => 'closed',
            }]);

            return $doc;
        });
    }

    public function delete(Document $document): void
    {
        DB::transaction(function () use ($document) {
            $this->stock->reverseDocument($document);
            Payment::where('document_id', $document->id)->delete();
            $document->delete();
        });
    }
}
