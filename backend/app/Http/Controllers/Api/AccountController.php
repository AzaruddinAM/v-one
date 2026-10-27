<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Expense;
use App\Models\JournalLine;
use App\Models\Payment;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    private function rules(?Account $account = null): array
    {
        return [
            'code' => ['required', 'string', 'max:20', Tenant::unique('accounts', 'code', $account?->id)],
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in(Account::TYPES)],
            'sub_type' => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:500'],
            'opening_balance' => ['nullable', 'numeric'],
            'is_active' => ['boolean'],
        ];
    }

    public function index(Request $request)
    {
        $q = Account::query()->when($request->type, fn ($q, $t) => $q->where('type', $t));

        return $this->search($q, $request->q, ['name', 'code'])->orderBy('code')->get();
    }

    public function store(Request $request)
    {
        return response()->json(Account::create($request->validate($this->rules())), 201);
    }

    public function show(Account $account)
    {
        return $account;
    }

    public function update(Request $request, Account $account)
    {
        $data = $request->validate($this->rules($account));
        if ($account->is_system) {
            unset($data['type'], $data['code']);
        }
        $account->update($data);

        return $account;
    }

    public function destroy(Account $account)
    {
        abort_if($account->is_system, 422, 'System accounts cannot be deleted.');
        abort_if(
            JournalLine::where('account_id', $account->id)->exists()
            || Expense::where('account_id', $account->id)->orWhere('paid_through_id', $account->id)->exists()
            || Payment::where('account_id', $account->id)->exists(),
            422, 'This account has transactions and cannot be deleted.'
        );
        $account->delete();

        return response()->noContent();
    }
}
