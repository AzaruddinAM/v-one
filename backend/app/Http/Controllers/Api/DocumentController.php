<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Document;
use App\Services\DocumentService;
use App\Services\NumberGenerator;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    public function __construct(private DocumentService $service) {}

    private function rules(?Document $document = null): array
    {
        $type = $document?->type ?? request('type');
        $contactType = in_array($type, Document::SALES, true) ? 'customer' : 'vendor';

        return [
            'type' => [$document ? 'prohibited' : 'required', Rule::in(Document::TYPES)],
            'number' => ['nullable', 'string', 'max:40',
                Rule::unique('documents', 'number')->where('organization_id', Tenant::id())->where('type', $type)->ignore($document?->id)],
            'reference' => ['nullable', 'string', 'max:60'],
            'contact_id' => ['required', Tenant::exists('contacts')->where('type', $contactType)],
            'date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:date'],
            'payment_terms' => ['nullable', 'string', 'max:30'],
            'status' => ['nullable', Rule::in(Document::MANUAL_STATUSES[$type] ?? ['draft'])],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'adjustment' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'terms' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.item_id' => ['nullable', Tenant::exists('items')],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:1000'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.rate' => ['required', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'between:0,100'],
            'items.*.tax_id' => ['nullable', Tenant::exists('taxes')],
        ];
    }

    public function index(Request $request)
    {
        $request->validate(['type' => ['required', Rule::in(Document::TYPES)]]);

        $q = Document::query()->where('type', $request->type)->with('contact:id,name,company_name')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->contact_id, fn ($q, $c) => $q->where('contact_id', $c))
            ->when($request->from, fn ($q, $d) => $q->where('date', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->where('date', '<=', $d));

        if ($term = trim((string) $request->q)) {
            $q->where(fn ($w) => $w->where('number', 'like', "%$term%")->orWhere('reference', 'like', "%$term%")
                ->orWhereHas('contact', fn ($c) => $c->where('name', 'like', "%$term%")));
        }
        $this->columnFilters($q, $request, [
            'number' => ['number', 'like'],
            'reference' => ['reference', 'like'],
            'contact' => static::whereRelated('contact', ['name', 'company_name']),
            'status' => ['status', 'eq'],
            'date_from' => ['date', 'from'],
            'date_to' => ['date', 'to'],
            'due_from' => ['due_date', 'from'],
            'due_to' => ['due_date', 'to'],
            'total_min' => ['total', 'min'],
            'total_max' => ['total', 'max'],
            'balance_min' => ['balance', 'min'],
            'balance_max' => ['balance', 'max'],
        ]);
        $this->sort($q, $request, ['date', 'number', 'total', 'balance', 'due_date', 'status', 'id'], '-date', [
            'contact' => static::orderByRelated('contacts', 'contact_id', 'name'),
        ]);
        $q->orderByDesc('documents.id');

        return $this->paginate($q, $request);
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $data['status'] ??= 'draft';

        return response()->json($this->service->save($data), 201);
    }

    public function show(Document $document)
    {
        return $document->load(['contact', 'items', 'payments' => fn ($q) => $q->orderBy('date'), 'convertedFrom:id,type,number']);
    }

    public function update(Request $request, Document $document)
    {
        abort_if($document->status === 'void', 422, 'Void documents cannot be edited.');
        $data = $request->validate($this->rules($document));
        $data['status'] ??= $document->status;
        if (in_array($data['status'], ['paid', 'partial', 'overdue'], true)) {
            $data['status'] = $document->type === 'invoice' ? 'sent' : 'open';
        }

        return $this->service->save($data, $document);
    }

    public function destroy(Document $document)
    {
        $this->service->delete($document);

        return response()->noContent();
    }

    public function status(Request $request, Document $document)
    {
        $data = $request->validate(['status' => ['required', Rule::in(Document::MANUAL_STATUSES[$document->type])]]);
        abort_if($data['status'] === 'void' && $document->amount_paid > 0, 422, 'Delete the payments before voiding this document.');

        return $this->service->changeStatus($document, $data['status']);
    }

    public function convert(Request $request, Document $document)
    {
        $map = ['estimate' => 'invoice', 'sales_order' => 'invoice', 'delivery_challan' => 'invoice', 'purchase_order' => 'bill'];
        abort_unless(isset($map[$document->type]), 422, 'This document cannot be converted.');
        abort_if($document->status === 'void', 422, 'Void documents cannot be converted.');

        return response()->json($this->service->convert($document->load('items', 'contact'), $map[$document->type]), 201);
    }

    public function nextNumber(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(Document::TYPES)],
            'contact_id' => ['nullable', 'integer'],
            'date' => ['nullable', 'date'],
        ]);
        $contact = isset($data['contact_id']) ? Contact::find($data['contact_id']) : null;

        return ['number' => NumberGenerator::forDocument($data['type'], $contact, $data['date'] ?? null)];
    }

    /** Overdue invoices with the customer's contact details, for the payment reminders page. */
    public function overdue(Request $request)
    {
        $docs = Document::where('type', 'invoice')->whereNotIn('status', ['draft', 'void', 'paid'])
            ->where('balance', '>', 0)->whereNotNull('due_date')->where('due_date', '<', today())
            ->when($request->contact_id, fn ($q, $c) => $q->where('contact_id', $c))
            ->with('contact:id,name,company_name,email,phone')
            ->orderBy('due_date')->limit(500)
            ->get(['id', 'type', 'number', 'contact_id', 'date', 'due_date', 'status', 'total', 'balance', 'reminded_at', 'reminder_count']);

        return $docs->map(fn (Document $d) => $d->toArray() + ['days_overdue' => (int) $d->due_date->diffInDays(today())]);
    }

    /** Record that a payment reminder was sent (by email / WhatsApp from the browser). */
    public function reminded(Document $document)
    {
        abort_unless($document->type === 'invoice', 422, 'Reminders are only for invoices.');
        $document->forceFill(['reminded_at' => now(), 'reminder_count' => $document->reminder_count + 1])->save();

        return $document->only(['id', 'reminded_at', 'reminder_count']);
    }
}
