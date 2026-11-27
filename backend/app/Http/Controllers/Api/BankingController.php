<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\ReconciledEntry;
use App\Models\Reconciliation;
use App\Services\LedgerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Cash and bank accounts: balances, transactions with running balance, and statement reconciliation. */
class BankingController extends Controller
{
    private const FAR = '9999-12-31';

    public function __construct(private LedgerService $ledger) {}

    private function money(Account $account): Account
    {
        abort_unless(in_array($account->sub_type, ['cash', 'bank'], true), 404);

        return $account;
    }

    public function index()
    {
        // Make sure the default cash and bank accounts exist before listing.
        $this->ledger->account('cash');
        $this->ledger->account('bank');
        $balances = $this->ledger->balances(today()->toDateString());
        $all = $this->ledger->entries(self::FAR);
        $reconciled = ReconciledEntry::get(['account_id', 'entry_key'])->groupBy('account_id')
            ->map(fn ($g) => $g->pluck('entry_key')->flip());
        $last = Reconciliation::orderByDesc('statement_date')->orderByDesc('id')->get()->unique('account_id')->keyBy('account_id');

        return Account::whereIn('sub_type', ['cash', 'bank'])->where('type', 'asset')->orderBy('code')->get()
            ->map(function (Account $a) use ($balances, $all, $reconciled, $last) {
                $done = $reconciled->get($a->id, collect());
                $rec = $last->get($a->id);

                return $a->only(['id', 'code', 'name', 'sub_type', 'description', 'is_active', 'is_system']) + [
                    'balance' => $balances[$a->id] ?? 0.0,
                    'uncleared' => $all->where('account_id', $a->id)->filter(fn ($x) => ! isset($done[$x['key']]))->count(),
                    'last_reconciled' => $rec?->statement_date?->toDateString(),
                    'reconciled_balance' => $rec?->cleared_balance,
                ];
            })->values();
    }

    /** Entries of one account with a running balance and their reconciled state. */
    public function transactions(Request $request, Account $account)
    {
        $this->money($account);
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date'], 'uncleared' => ['nullable', 'boolean']]);
        $to = $request->to ?: self::FAR;
        $from = $request->from;
        $done = ReconciledEntry::where('account_id', $account->id)->pluck('reconciliation_id', 'entry_key');

        $opening = 0.0;
        $running = 0.0;
        $rows = [];
        foreach ($this->ledger->entries($to) as $x) {
            if ($x['account_id'] !== $account->id) {
                continue;
            }
            $running += $x['debit'] - $x['credit'];
            if ($from && ($x['date'] === null || $x['date'] < $from)) {
                $opening = $running;

                continue;
            }
            $row = $x + ['balance' => round($running, 2), 'reconciliation_id' => $done[$x['key']] ?? null];
            if ($request->boolean('uncleared') && $row['reconciliation_id']) {
                continue;
            }
            $rows[] = $row;
        }

        return [
            'account' => $account->only(['id', 'code', 'name', 'sub_type']),
            'opening' => round($opening, 2),
            'rows' => array_reverse($rows), // newest first
            'closing' => round($running, 2),
            'cleared_balance' => $this->clearedBalance($account),
        ];
    }

    /** Sum of every reconciled entry of the account: the balance the bank already agrees with. */
    private function clearedBalance(Account $account, ?array $extraKeys = null): float
    {
        $keys = ReconciledEntry::where('account_id', $account->id)->pluck('entry_key')->flip()->all();
        foreach ($extraKeys ?? [] as $k) {
            $keys[$k] = true;
        }
        $sum = 0.0;
        foreach ($this->ledger->entries(self::FAR) as $x) {
            if ($x['account_id'] === $account->id && isset($keys[$x['key']])) {
                $sum += $x['debit'] - $x['credit'];
            }
        }

        return round($sum, 2);
    }

    public function reconciliations(Account $account)
    {
        $this->money($account);

        return Reconciliation::where('account_id', $account->id)->with('creator:id,name')
            ->orderByDesc('statement_date')->orderByDesc('id')->get();
    }

    public function reconcile(Request $request, Account $account)
    {
        $this->money($account);
        $data = $request->validate([
            'statement_date' => ['required', 'date'],
            'statement_balance' => ['required', 'numeric'],
            'keys' => ['required', 'array', 'min:1'],
            'keys.*' => ['string', 'max:60', 'distinct'],
        ]);

        return DB::transaction(function () use ($account, $data, $request) {
            $entries = $this->ledger->entries($data['statement_date'])->where('account_id', $account->id)->keyBy('key');
            $already = ReconciledEntry::where('account_id', $account->id)->pluck('entry_key')->flip();
            foreach ($data['keys'] as $k) {
                if (! $entries->has($k)) {
                    throw ValidationException::withMessages(['keys' => 'A ticked transaction is dated after the statement date or is not in this account.']);
                }
                if ($already->has($k)) {
                    throw ValidationException::withMessages(['keys' => 'A ticked transaction is already reconciled.']);
                }
            }
            $cleared = $this->clearedBalance($account, $data['keys']);
            $diff = round($data['statement_balance'] - $cleared, 2);
            if (abs($diff) >= 0.005) {
                throw ValidationException::withMessages(['statement_balance' => 'Cleared balance '.number_format($cleared, 2)
                    .' does not match the statement balance (difference '.number_format($diff, 2).').']);
            }
            $rec = Reconciliation::create([
                'account_id' => $account->id, 'statement_date' => $data['statement_date'],
                'statement_balance' => round($data['statement_balance'], 2), 'cleared_balance' => $cleared,
                'entries_count' => count($data['keys']), 'created_by' => $request->user()->id,
            ]);
            foreach ($data['keys'] as $k) {
                ReconciledEntry::create(['account_id' => $account->id, 'reconciliation_id' => $rec->id, 'entry_key' => $k]);
            }

            return response()->json($rec, 201);
        });
    }

    /** Undo the latest reconciliation of an account; its entries become uncleared again. */
    public function undo(Reconciliation $reconciliation)
    {
        $latest = Reconciliation::where('account_id', $reconciliation->account_id)
            ->orderByDesc('statement_date')->orderByDesc('id')->value('id');
        if ($latest !== $reconciliation->id) {
            throw ValidationException::withMessages(['reconciliation' => 'Only the latest reconciliation of an account can be undone.']);
        }
        DB::transaction(function () use ($reconciliation) {
            $reconciliation->entries()->delete();
            $reconciliation->delete();
        });

        return response()->noContent();
    }
}
