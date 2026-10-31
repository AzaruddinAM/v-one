<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Tax;
use App\Support\Tenant;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
            'account_id' => ['required', Tenant::exists('accounts')->where('type', 'expense')],
            'paid_through_id' => ['nullable', Tenant::exists('accounts')->where('type', 'asset')],
            'contact_id' => ['nullable', Tenant::exists('contacts')->where('type', 'vendor')],
            'amount' => ['required', 'numeric', 'gt:0'],
            'tax_id' => ['nullable', Tenant::exists('taxes')],
            'reference' => ['nullable', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);
        $rate = ! empty($data['tax_id']) ? (float) Tax::find($data['tax_id'])->rate : 0;
        $data['tax_amount'] = round($data['amount'] * $rate / 100, 2);
        $data['total'] = round($data['amount'] + $data['tax_amount'], 2);

        return $data;
    }

    public function index(Request $request)
    {
        $q = Expense::with(['account:id,name', 'paidThrough:id,name', 'contact:id,name'])
            ->when($request->account_id, fn ($q, $a) => $q->where('account_id', $a))
            ->when($request->from, fn ($q, $d) => $q->where('date', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->where('date', '<=', $d));
        $this->search($q, $request->q, ['reference', 'description']);
        $this->sort($q, $request, ['date', 'total', 'id'], '-date');

        return $this->paginate($q->orderByDesc('expenses.id'), $request);
    }

    public function store(Request $request)
    {
        return response()->json(Expense::create($this->validated($request))->load('account:id,name'), 201);
    }

    public function show(Expense $expense)
    {
        return $expense->load(['account', 'paidThrough', 'contact', 'tax']);
    }

    public function update(Request $request, Expense $expense)
    {
        $expense->update($this->validated($request));

        return $expense->load('account:id,name');
    }

    public function destroy(Expense $expense)
    {
        $expense->delete();

        return response()->noContent();
    }
}
