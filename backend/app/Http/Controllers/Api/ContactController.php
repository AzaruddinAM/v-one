<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Document;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContactController extends Controller
{
    private function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['customer', 'vendor'])],
            'name' => ['required', 'string', 'max:150'],
            'company_name' => ['nullable', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:20'],
            'gstin' => ['nullable', 'string', 'max:30'],
            'pan' => ['nullable', 'string', 'max:20'],
            'billing_address' => ['nullable', 'string', 'max:500'],
            'shipping_address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'string', 'max:20'],
            'opening_balance' => ['nullable', 'numeric'],
            'payment_terms' => ['nullable', 'integer', 'between:0,365'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['boolean'],
        ];
    }

    public function index(Request $request)
    {
        $balanceType = $request->type === 'vendor' ? 'bill' : 'invoice';
        $q = Contact::query()
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->has('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->withSum(['documents as outstanding' => fn ($d) => $d->where('type', $balanceType)->whereNotIn('status', ['draft', 'void'])], 'balance');
        $this->search($q, $request->q, ['name', 'company_name', 'email', 'phone']);
        $this->sort($q, $request, ['name', 'created_at', 'id'], 'name');

        return $this->paginate($q, $request);
    }

    public function store(Request $request)
    {
        return response()->json(Contact::create($request->validate($this->rules())), 201);
    }

    public function show(Contact $contact)
    {
        $docType = $contact->type === 'customer' ? 'invoice' : 'bill';
        $live = fn () => Document::where('contact_id', $contact->id)->where('type', $docType)->whereNotIn('status', ['draft', 'void']);

        return array_merge($contact->toArray(), [
            'summary' => [
                'outstanding' => round((float) $live()->sum('balance'), 2),
                'total_billed' => round((float) $live()->sum('total'), 2),
                'total_paid' => round((float) $live()->sum('amount_paid'), 2),
            ],
            'recent_documents' => Document::where('contact_id', $contact->id)->latest('date')->limit(10)
                ->get(['id', 'type', 'number', 'date', 'due_date', 'total', 'balance', 'status']),
        ]);
    }

    public function update(Request $request, Contact $contact)
    {
        $contact->update($request->validate($this->rules()));

        return $contact;
    }

    public function destroy(Contact $contact)
    {
        abort_if($contact->documents()->exists() || $contact->payments()->exists(), 422,
            'This contact has transactions. Mark it inactive instead.');
        $contact->delete();

        return response()->noContent();
    }

    public function statement(Request $request, Contact $contact, ReportService $reports)
    {
        [$from, $to] = ReportService::period($request->from, $request->to, $request->user()->organization->fiscal_year_start);

        return $reports->contactStatement($contact, $from, $to);
    }
}
