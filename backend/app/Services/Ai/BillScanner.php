<?php

namespace App\Services\Ai;

use App\Models\Account;
use App\Models\Contact;
use App\Models\Item;
use App\Models\Tax;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * Reads a bill / invoice / receipt (image or PDF) with Gemini and turns it into an
 * editable preview, matched against the organization's vendors, items and taxes.
 * Nothing is saved here — the user reviews the preview and confirms via BillImporter.
 */
class BillScanner
{
    private const SYSTEM = <<<'TXT'
    You are an expert accounts-payable clerk for Indian small businesses. You read purchase bills, tax invoices,
    receipts and expense vouchers (printed, handwritten or photographed) and extract their data precisely.
    Rules:
    - The "vendor" is the business that ISSUED the bill (the seller / supplier), never the buyer ("Bill to").
    - Dates must be ISO format YYYY-MM-DD. Indian bills use DD/MM/YYYY — convert carefully.
    - "rate" is the unit price BEFORE tax. If the bill only shows tax-inclusive prices, back out the tax.
    - "tax_rate" is the total GST % for the line (CGST + SGST, or IGST). Use 0 if no tax applies.
    - Amounts are plain numbers without currency symbols or thousands separators.
    - Never invent data: use null for anything that is not printed on the document.
    - If the image is not a bill/receipt at all, set is_bill to false.
    - suggested_category: one short expense category such as Rent, Utilities, Office Supplies, Travel & Conveyance,
      Advertising & Marketing, Internet & Telephone, Repairs & Maintenance, Bank Charges, Salaries & Wages,
      Cost of Goods Sold or Miscellaneous Expenses.
    TXT;

    public function __construct(private GeminiClient $gemini) {}

    public function scan(UploadedFile $file): array
    {
        $data = $this->gemini->json([
            ['inlineData' => ['mimeType' => $this->mime($file), 'data' => base64_encode($file->getContent())]],
            ['text' => 'Extract all data from this document.'],
        ], self::schema(), self::SYSTEM);

        return $this->preview($data);
    }

    /** Match extracted data with existing records and shape it for the review screen. */
    public function preview(array $x): array
    {
        $warnings = [];
        if (($x['is_bill'] ?? true) === false) {
            $warnings[] = 'This does not look like a bill or receipt. Please check the extracted data carefully.';
        }

        $v = (array) ($x['vendor'] ?? []);
        $vendor = $this->matchVendor($v['name'] ?? null, $v['gstin'] ?? null);
        $taxes = Tax::where('is_active', true)->get(['id', 'name', 'rate']);

        $items = collect($x['items'] ?? [])->filter(fn ($l) => trim((string) ($l['name'] ?? '')) !== '')
            ->values()->map(function ($l) use ($taxes, &$warnings) {
                $match = $this->matchItem((string) $l['name']);
                $rate = (float) ($l['tax_rate'] ?? 0);
                $tax = $taxes->first(fn ($t) => abs($t->rate - $rate) < 0.01);
                if ($rate > 0 && ! $tax) {
                    $warnings[] = "No tax rate of {$rate}% exists — line \"{$l['name']}\" was left without tax.";
                }
                $qty = (float) ($l['quantity'] ?? 0) ?: 1;
                $unitRate = $l['rate'] ?? null;
                if ($unitRate === null && isset($l['amount'])) {
                    $unitRate = (float) $l['amount'] / $qty;
                }

                return [
                    'item_id' => $match?->id,
                    'matched_name' => $match?->name,
                    'name' => Str::limit(trim((string) $l['name']), 250, ''),
                    'description' => $l['description'] ?? null,
                    'hsn_code' => $l['hsn_code'] ?? null,
                    'quantity' => round($qty, 3),
                    'unit' => Str::limit((string) ($l['unit'] ?? $match?->unit ?? 'pcs'), 20, '') ?: 'pcs',
                    'rate' => round(max(0, (float) $unitRate), 2),
                    'discount_percent' => min(100, max(0, (float) ($l['discount_percent'] ?? 0))),
                    'tax_rate' => $rate,
                    'tax_id' => $tax?->id,
                    'create_item' => false,
                ];
            })->all();

        $subtotal = (float) ($x['subtotal'] ?? 0);
        $total = isset($x['total']) ? (float) $x['total'] : null;
        $taxTotal = (float) ($x['tax_total'] ?? 0) ?: (float) ($x['cgst'] ?? 0) + (float) ($x['sgst'] ?? 0) + (float) ($x['igst'] ?? 0);
        $kind = $x['document_kind'] ?? 'bill';
        $target = ! $items || in_array($kind, ['receipt', 'expense_voucher'], true) ? 'expense' : 'bill';

        if (! $items && $total === null) {
            $warnings[] = 'No line items or total could be read from this document.';
        }

        // Expense view: one amount before tax, with the dominant tax rate.
        $expenseBase = $subtotal ?: max(0, ($total ?? 0) - $taxTotal);
        $expenseRate = $expenseBase > 0 && $taxTotal > 0 ? round($taxTotal / $expenseBase * 100, 2) : 0;
        $expenseTax = $taxes->sortBy(fn ($t) => abs($t->rate - $expenseRate))->first();

        return [
            'target' => $target,
            'document_kind' => $kind,
            'confidence' => isset($x['confidence']) ? round((float) $x['confidence'], 2) : null,
            'warnings' => array_values(array_unique($warnings)),
            'vendor' => [
                'id' => $vendor?->id,
                'matched_name' => $vendor?->name,
                'name' => trim((string) ($v['name'] ?? '')),
                'gstin' => isset($v['gstin']) ? strtoupper(str_replace(' ', '', $v['gstin'])) : null,
                'pan' => $v['pan'] ?? null,
                'phone' => $v['phone'] ?? null,
                'email' => $v['email'] ?? null,
                'billing_address' => $v['address'] ?? null,
                'city' => $v['city'] ?? null,
                'state' => $v['state'] ?? null,
                'pincode' => $v['pincode'] ?? null,
            ],
            'reference' => $x['bill_number'] ?? null,
            'date' => $this->date($x['bill_date'] ?? null) ?? today()->toDateString(),
            'due_date' => $this->date($x['due_date'] ?? null),
            'discount' => round((float) ($x['discount'] ?? 0), 2),
            'notes' => $x['notes'] ?? null,
            'items' => $items,
            'extracted' => [
                'subtotal' => round($subtotal, 2),
                'tax_total' => round($taxTotal, 2),
                'total' => $total !== null ? round($total, 2) : null,
                'currency' => $x['currency'] ?? null,
            ],
            'expense' => [
                'account_id' => $this->matchExpenseAccount($x['suggested_category'] ?? null)?->id,
                'amount' => round($expenseBase, 2),
                'tax_id' => $expenseRate > 0 ? $expenseTax?->id : null,
                'description' => Str::limit(trim(($v['name'] ?? '').' '.($x['bill_number'] ?? '')), 250, '') ?: null,
            ],
        ];
    }

    private function matchVendor(?string $name, ?string $gstin): ?Contact
    {
        $q = Contact::where('type', 'vendor');
        if ($gstin && ($c = (clone $q)->whereRaw("UPPER(REPLACE(gstin, ' ', '')) = ?", [strtoupper(str_replace(' ', '', $gstin))])->first())) {
            return $c;
        }
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }

        return (clone $q)->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
            ?? (clone $q)->whereRaw('LOWER(company_name) = ?', [mb_strtolower($name)])->first()
            ?? (mb_strlen($name) >= 4 ? (clone $q)->where('name', 'like', '%'.addcslashes($name, '%_').'%')->first() : null);
    }

    private function matchItem(string $name): ?Item
    {
        $name = trim($name);

        return Item::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
            ?? Item::whereRaw('LOWER(sku) = ?', [mb_strtolower($name)])->first()
            ?? (mb_strlen($name) >= 4 ? Item::where('name', 'like', '%'.addcslashes($name, '%_').'%')->first() : null);
    }

    private function matchExpenseAccount(?string $category): ?Account
    {
        $accounts = Account::where('type', 'expense')->where('is_active', true)->get(['id', 'name']);
        $category = mb_strtolower(trim((string) $category));

        return ($category !== '' ? $accounts->first(fn ($a) => mb_strtolower($a->name) === $category)
                ?? $accounts->first(fn ($a) => str_contains(mb_strtolower($a->name), $category) || str_contains($category, mb_strtolower($a->name)))
                : null)
            ?? $accounts->first(fn ($a) => str_contains(mb_strtolower($a->name), 'miscellaneous'))
            ?? $accounts->first();
    }

    private function date(?string $value): ?string
    {
        if (! $value || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || ! strtotime($value)) {
            return null;
        }

        return $value;
    }

    private function mime(UploadedFile $file): string
    {
        $mime = $file->getMimeType() ?: 'application/octet-stream';

        return $mime === 'image/jpg' ? 'image/jpeg' : $mime;
    }

    public static function schema(): array
    {
        $str = ['type' => 'STRING', 'nullable' => true];
        $num = ['type' => 'NUMBER', 'nullable' => true];

        return [
            'type' => 'OBJECT',
            'properties' => [
                'is_bill' => ['type' => 'BOOLEAN'],
                'document_kind' => ['type' => 'STRING', 'enum' => ['tax_invoice', 'bill', 'receipt', 'expense_voucher', 'other']],
                'vendor' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'name' => $str, 'gstin' => $str, 'pan' => $str, 'phone' => $str, 'email' => $str,
                        'address' => $str, 'city' => $str, 'state' => $str, 'pincode' => $str,
                    ],
                ],
                'bill_number' => $str,
                'bill_date' => $str + ['description' => 'YYYY-MM-DD'],
                'due_date' => $str + ['description' => 'YYYY-MM-DD'],
                'currency' => $str,
                'items' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'name' => ['type' => 'STRING'], 'description' => $str, 'hsn_code' => $str,
                            'quantity' => $num, 'unit' => $str, 'rate' => $num + ['description' => 'unit price before tax'],
                            'discount_percent' => $num, 'tax_rate' => $num + ['description' => 'total GST percent'],
                            'amount' => $num,
                        ],
                        'required' => ['name'],
                    ],
                ],
                'subtotal' => $num, 'discount' => $num, 'tax_total' => $num,
                'cgst' => $num, 'sgst' => $num, 'igst' => $num, 'total' => $num,
                'notes' => $str,
                'suggested_category' => $str,
                'confidence' => $num + ['description' => '0 to 1, how sure you are about the extraction'],
            ],
            'required' => ['is_bill', 'document_kind', 'items'],
        ];
    }
}
