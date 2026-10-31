<?php

namespace App\Services\Ai;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Expense;
use App\Models\Item;
use App\Models\Tax;
use App\Services\DocumentService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/** Saves a reviewed bill preview: creates the vendor / items when needed, then the bill or expense. */
class BillImporter
{
    public function __construct(private DocumentService $documents) {}

    /** @return array{type: string, record: Document|Expense, created: array} */
    public function import(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $created = ['vendor' => false, 'items' => 0];
            $vendor = $this->vendor($data['vendor'] ?? [], $created);

            if ($data['target'] === 'expense') {
                $e = $data['expense'];
                $rate = ! empty($e['tax_id']) ? (float) Tax::find($e['tax_id'])->rate : 0;
                $taxAmount = round($e['amount'] * $rate / 100, 2);
                $expense = Expense::create([
                    'date' => $data['date'],
                    'account_id' => $e['account_id'],
                    'paid_through_id' => $e['paid_through_id'] ?? null,
                    'contact_id' => $vendor?->id,
                    'amount' => $e['amount'],
                    'tax_id' => $e['tax_id'] ?? null,
                    'tax_amount' => $taxAmount,
                    'total' => round($e['amount'] + $taxAmount, 2),
                    'reference' => $data['reference'] ?? null,
                    'description' => $e['description'] ?? $data['notes'] ?? null,
                ]);

                return ['type' => 'expense', 'record' => $expense->load('account:id,name'), 'created' => $created];
            }

            $lines = collect($data['items'])->map(function ($l) use (&$created) {
                if (empty($l['item_id']) && ! empty($l['create_item'])) {
                    $item = Item::create([
                        'name' => $l['name'],
                        'type' => 'goods',
                        'unit' => ($l['unit'] ?? null) ?: 'pcs',
                        'hsn_code' => $l['hsn_code'] ?? null,
                        'description' => $l['description'] ?? null,
                        'purchase_price' => $l['rate'],
                        'sales_price' => 0,
                        'tax_id' => $l['tax_id'] ?? null,
                    ]);
                    $l['item_id'] = $item->id;
                    $created['items']++;
                }

                return collect($l)->only(['item_id', 'name', 'description', 'quantity', 'unit', 'rate', 'discount_percent', 'tax_id'])->all();
            })->all();

            $bill = $this->documents->save([
                'type' => 'bill',
                'contact_id' => $vendor->id,
                'reference' => $data['reference'] ?? null,
                'date' => $data['date'],
                'due_date' => $data['due_date'] ?? Carbon::parse($data['date'])->addDays($vendor->payment_terms ?? 30)->toDateString(),
                'status' => $data['status'] ?? 'open',
                'discount' => $data['discount'] ?? 0,
                'adjustment' => $data['adjustment'] ?? 0,
                'notes' => $data['notes'] ?? null,
                'items' => $lines,
            ]);

            return ['type' => 'bill', 'record' => $bill, 'created' => $created];
        });
    }

    private function vendor(array $v, array &$created): ?Contact
    {
        if (! empty($v['id'])) {
            return Contact::where('type', 'vendor')->findOrFail($v['id']);
        }
        if (trim((string) ($v['name'] ?? '')) === '') {
            return null;
        }
        $created['vendor'] = true;

        return Contact::create(collect($v)->only([
            'name', 'company_name', 'gstin', 'pan', 'phone', 'email', 'billing_address', 'city', 'state', 'pincode',
        ])->all() + ['type' => 'vendor', 'country' => 'India']);
    }
}
