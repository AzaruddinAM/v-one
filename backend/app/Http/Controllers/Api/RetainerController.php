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
use Illuminate\Validation\ValidationException;

/**
 * Retainer (advance) invoices: the customer pays the retainer first, and the amount received
 * is later applied to one or more of their invoices. An application is stored as a payment on
 * the invoice with mode "retainer" and retainer_id set; no cash moves.
 */
class RetainerController extends Controller
{
    public function __construct(private DocumentService $documents) {}

    private function retainer(Document $document): Document
    {
        abort_unless($document->type === 'retainer_invoice', 404);

        return $document;
    }

    private function summary(Document $retainer): array
    {
        $received = round((float) Payment::where('document_id', $retainer->id)->sum('amount'), 2);
        $applications = Payment::where('retainer_id', $retainer->id)->with('document:id,number,date,total,balance')
            ->orderBy('date')->orderBy('id')->get(['id', 'number', 'date', 'amount', 'document_id']);
        $applied = round((float) $applications->sum('amount'), 2);

        return ['received' => $received, 'applied' => $applied, 'unapplied' => round($received - $applied, 2), 'applications' => $applications];
    }

    /** Amounts received and applied, and the customer's invoices it can still be applied to. */
    public function show(Document $document)
    {
        $retainer = $this->retainer($document);
        $invoices = Document::where('type', 'invoice')->where('contact_id', $retainer->contact_id)
            ->whereNotIn('status', ['draft', 'void', 'paid'])->where('balance', '>', 0)
            ->orderBy('date')->get(['id', 'number', 'date', 'due_date', 'total', 'balance']);

        return $this->summary($retainer) + ['invoices' => $invoices];
    }

    public function apply(Request $request, Document $document)
    {
        $retainer = $this->retainer($document);
        $data = $request->validate([
            'invoice_id' => ['required', Tenant::exists('documents')],
            'amount' => ['required', 'numeric', 'gt:0'],
            'date' => ['nullable', 'date'],
        ]);

        return DB::transaction(function () use ($retainer, $data) {
            $invoice = Document::lockForUpdate()->findOrFail($data['invoice_id']);
            Document::lockForUpdate()->find($retainer->id);
            if ($invoice->type !== 'invoice' || (int) $invoice->contact_id !== (int) $retainer->contact_id
                || in_array($invoice->status, ['draft', 'void'], true)) {
                throw ValidationException::withMessages(['invoice_id' => 'Choose an open invoice of the same customer.']);
            }
            $left = $this->summary($retainer)['unapplied'];
            if ($data['amount'] - $left > 0.009) {
                throw ValidationException::withMessages(['amount' => 'Only '.number_format($left, 2).' of this retainer is left to apply.']);
            }
            if ($data['amount'] - $invoice->balance > 0.009) {
                throw ValidationException::withMessages(['amount' => 'Amount exceeds the invoice balance ('.number_format($invoice->balance, 2).').']);
            }
            Payment::create([
                'direction' => 'in',
                'number' => NumberGenerator::next(Payment::where('direction', 'in'), 'PR-'),
                'contact_id' => $invoice->contact_id,
                'document_id' => $invoice->id,
                'retainer_id' => $retainer->id,
                'date' => $data['date'] ?? today()->toDateString(),
                'amount' => round($data['amount'], 2),
                'mode' => Payment::RETAINER,
                'reference' => $retainer->number,
                'notes' => 'Applied from retainer '.$retainer->number,
            ]);
            $this->documents->refreshPaymentStatus($invoice);

            return response()->json($this->summary($retainer), 201);
        });
    }
}
