<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Payment;
use App\Services\DocumentService;
use App\Services\NumberGenerator;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function __construct(private DocumentService $documents) {}

    public function index(Request $request)
    {
        $request->validate(['direction' => ['required', Rule::in(['in', 'out'])]]);
        $q = Payment::where('direction', $request->direction)
            ->with(['contact:id,name', 'document:id,type,number', 'account:id,name'])
            ->when($request->contact_id, fn ($q, $c) => $q->where('contact_id', $c))
            ->when($request->mode, fn ($q, $m) => $q->where('mode', $m))
            ->when($request->from, fn ($q, $d) => $q->where('date', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->where('date', '<=', $d));
        if ($term = trim((string) $request->q)) {
            $q->where(fn ($w) => $w->where('number', 'like', "%$term%")->orWhere('reference', 'like', "%$term%")
                ->orWhereHas('contact', fn ($c) => $c->where('name', 'like', "%$term%")));
        }
        $this->sort($q, $request, ['date', 'amount', 'number', 'id'], '-date');

        return $this->paginate($q->orderByDesc('payments.id'), $request);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'direction' => ['required', Rule::in(['in', 'out'])],
            'contact_id' => ['required', Tenant::exists('contacts')],
            'document_id' => ['nullable', Tenant::exists('documents')],
            'account_id' => ['nullable', Tenant::exists('accounts')],
            'date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'mode' => ['required', Rule::in(Payment::MODES)],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        return DB::transaction(function () use ($data) {
            if (! empty($data['document_id'])) {
                $doc = Document::lockForUpdate()->findOrFail($data['document_id']);
                $expected = $data['direction'] === 'in' ? ['invoice', 'retainer_invoice'] : ['bill'];
                if (! in_array($doc->type, $expected, true) || (int) $doc->contact_id !== (int) $data['contact_id']) {
                    throw ValidationException::withMessages(['document_id' => 'The document does not match this payment.']);
                }
                if (in_array($doc->status, ['draft', 'void'], true)) {
                    throw ValidationException::withMessages(['document_id' => 'Payments cannot be recorded against a draft or void document.']);
                }
                if ($data['amount'] - $doc->balance > 0.009) {
                    throw ValidationException::withMessages(['amount' => 'Amount exceeds the balance due ('.number_format($doc->balance, 2).').']);
                }
            }
            $prefix = $data['direction'] === 'in' ? 'PR-' : 'PM-';
            $data['number'] = NumberGenerator::next(Payment::where('direction', $data['direction']), $prefix);
            $payment = Payment::create($data);

            if (isset($doc)) {
                $this->documents->refreshPaymentStatus($doc);
            }

            return response()->json($payment->load(['contact:id,name', 'document:id,type,number,status,balance']), 201);
        });
    }

    public function show(Payment $payment)
    {
        return $payment->load(['contact', 'document', 'account']);
    }

    public function destroy(Payment $payment)
    {
        if ($payment->document?->type === 'retainer_invoice'
            && Payment::where('retainer_id', $payment->document_id)->exists()
            && Payment::where('document_id', $payment->document_id)->sum('amount') - $payment->amount
                < Payment::where('retainer_id', $payment->document_id)->sum('amount') - 0.009) {
            throw ValidationException::withMessages(['payment' => 'This advance has been applied to invoices. Remove those applications first.']);
        }
        DB::transaction(function () use ($payment) {
            $doc = $payment->document()->first();
            $payment->delete();
            if ($doc) {
                $this->documents->refreshPaymentStatus($doc);
            }
        });

        return response()->noContent();
    }
}
