<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Contact;
use App\Models\Document;
use App\Models\Expense;
use App\Models\Item;
use App\Models\JournalLine;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ReportService
{
    private const LIVE = ['draft', 'void'];

    private function live(string $type): Builder
    {
        return Document::where('type', $type)->whereNotIn('status', self::LIVE);
    }

    private function between(Builder $q, string $from, string $to, string $col = 'date'): Builder
    {
        return $q->whereBetween($col, [$from, $to]);
    }

    /** Journal totals per account (debit - credit) within an optional period. */
    private function journalNet(?string $from, string $to): array
    {
        $orgId = auth()->user()->organization_id;

        return JournalLine::query()
            ->join('journals', 'journals.id', '=', 'journal_lines.journal_id')
            ->where('journals.organization_id', $orgId)
            ->when($from, fn ($q) => $q->where('journals.date', '>=', $from))
            ->where('journals.date', '<=', $to)
            ->groupBy('journal_lines.account_id')
            ->select('journal_lines.account_id', DB::raw('SUM(debit) - SUM(credit) as net'))
            ->pluck('net', 'account_id')->map(fn ($v) => (float) $v)->all();
    }

    public function dashboard(): array
    {
        $today = today();
        $monthStart = $today->copy()->startOfMonth()->toDateString();
        $todayStr = $today->toDateString();

        $receivable = (float) $this->live('invoice')->sum('balance');
        $payable = (float) $this->live('bill')->sum('balance');
        $overdueReceivable = (float) $this->live('invoice')->where('balance', '>', 0)
            ->whereNotNull('due_date')->where('due_date', '<', $todayStr)->sum('balance');
        $overduePayable = (float) $this->live('bill')->where('balance', '>', 0)
            ->whereNotNull('due_date')->where('due_date', '<', $todayStr)->sum('balance');

        $salesMonth = (float) $this->between($this->live('invoice'), $monthStart, $todayStr)->sum('total');
        $expenseMonth = (float) Expense::whereBetween('date', [$monthStart, $todayStr])->sum('total')
            + (float) $this->between($this->live('bill'), $monthStart, $todayStr)->sum('total');
        $receivedMonth = (float) Payment::where('direction', 'in')->whereBetween('date', [$monthStart, $todayStr])->sum('amount');

        // Last 12 months trend — grouped in PHP for MySQL / SQLite portability.
        $start = $today->copy()->subMonths(11)->startOfMonth();
        $months = [];
        for ($i = 0; $i < 12; $i++) {
            $key = $start->copy()->addMonths($i)->format('Y-m');
            $months[$key] = ['month' => $key, 'sales' => 0.0, 'expenses' => 0.0];
        }
        $this->between($this->live('invoice'), $start->toDateString(), $todayStr)->get(['date', 'total'])
            ->each(function ($d) use (&$months) { $months[$d->date->format('Y-m')]['sales'] += $d->total; });
        $this->between($this->live('bill'), $start->toDateString(), $todayStr)->get(['date', 'total'])
            ->each(function ($d) use (&$months) { $months[$d->date->format('Y-m')]['expenses'] += $d->total; });
        Expense::whereBetween('date', [$start->toDateString(), $todayStr])->get(['date', 'total'])
            ->each(function ($e) use (&$months) { $months[$e->date->format('Y-m')]['expenses'] += $e->total; });

        $topCustomers = $this->live('invoice')
            ->select('contact_id', DB::raw('SUM(total) as total'))
            ->groupBy('contact_id')->orderByDesc('total')->limit(5)->with('contact:id,name')->get()
            ->map(fn ($r) => ['id' => $r->contact_id, 'name' => $r->contact?->name, 'total' => (float) $r->total]);

        $recent = Document::whereIn('type', ['invoice', 'bill'])->with('contact:id,name')
            ->latest('id')->limit(6)->get(['id', 'type', 'number', 'contact_id', 'date', 'total', 'balance', 'status']);

        $lowStock = Item::where('track_inventory', true)->whereColumn('stock_on_hand', '<=', 'reorder_level')
            ->orderBy('stock_on_hand')->limit(5)->get(['id', 'name', 'sku', 'stock_on_hand', 'reorder_level', 'unit']);

        return [
            'receivable' => round($receivable, 2),
            'payable' => round($payable, 2),
            'overdue_receivable' => round($overdueReceivable, 2),
            'overdue_payable' => round($overduePayable, 2),
            'sales_this_month' => round($salesMonth, 2),
            'expenses_this_month' => round($expenseMonth, 2),
            'received_this_month' => round($receivedMonth, 2),
            'counts' => [
                'customers' => Contact::where('type', 'customer')->count(),
                'vendors' => Contact::where('type', 'vendor')->count(),
                'items' => Item::count(),
                'unpaid_invoices' => $this->live('invoice')->where('balance', '>', 0)->count(),
            ],
            'trend' => array_values(array_map(fn ($m) => [
                'month' => $m['month'], 'sales' => round($m['sales'], 2), 'expenses' => round($m['expenses'], 2),
            ], $months)),
            'top_customers' => $topCustomers,
            'recent' => $recent,
            'low_stock' => $lowStock,
        ];
    }

    public function profitAndLoss(string $from, string $to): array
    {
        $sales = (float) $this->between($this->live('invoice'), $from, $to)->sum(DB::raw('subtotal - discount'));
        $returns = (float) $this->between($this->live('credit_note'), $from, $to)->sum(DB::raw('subtotal - discount'));
        $purchases = (float) $this->between($this->live('bill'), $from, $to)->sum(DB::raw('subtotal - discount'));

        $accounts = Account::whereIn('type', ['income', 'expense'])->get()->keyBy('id');
        $journal = $this->journalNet($from, $to);

        $income = [['name' => 'Sales', 'amount' => round($sales, 2)]];
        if ($returns) {
            $income[] = ['name' => 'Less: Sales Returns', 'amount' => -round($returns, 2)];
        }
        $expenses = [];
        if ($purchases) {
            $expenses[] = ['name' => 'Purchases (Bills)', 'amount' => round($purchases, 2)];
        }

        Expense::whereBetween('date', [$from, $to])
            ->select('account_id', DB::raw('SUM(amount) as amount'))->groupBy('account_id')->get()
            ->each(function ($r) use (&$expenses, $accounts) {
                $expenses[] = ['name' => $accounts[$r->account_id]->name ?? 'Expense', 'amount' => round((float) $r->amount, 2)];
            });

        foreach ($journal as $accountId => $net) {
            if (! isset($accounts[$accountId]) || ! $net) {
                continue;
            }
            $a = $accounts[$accountId];
            if ($a->type === 'income') {
                $income[] = ['name' => $a->name.' (Journal)', 'amount' => round(-$net, 2)];
            } else {
                $expenses[] = ['name' => $a->name.' (Journal)', 'amount' => round($net, 2)];
            }
        }

        $totalIncome = round(array_sum(array_column($income, 'amount')), 2);
        $totalExpense = round(array_sum(array_column($expenses, 'amount')), 2);

        return [
            'from' => $from, 'to' => $to,
            'income' => $income, 'expenses' => $expenses,
            'total_income' => $totalIncome, 'total_expenses' => $totalExpense,
            'net_profit' => round($totalIncome - $totalExpense, 2),
        ];
    }

    public function balanceSheet(string $asOf): array
    {
        $accounts = Account::all()->keyBy('id');
        $journal = $this->journalNet(null, $asOf);
        $upTo = fn (Builder $q) => $q->where('date', '<=', $asOf);

        $cashAccounts = $accounts->filter(fn ($a) => in_array($a->sub_type, ['cash', 'bank'], true));
        $cash = $cashAccounts->sum('opening_balance')
            + (float) $upTo(Payment::where('direction', 'in'))->sum('amount')
            - (float) $upTo(Payment::where('direction', 'out'))->sum('amount')
            - (float) $upTo(Expense::query())->sum('total')
            + collect($journal)->only($cashAccounts->keys()->all())->sum();

        $receivable = (float) $upTo($this->live('invoice'))->sum('balance')
            - (float) $upTo($this->live('credit_note'))->where('status', 'open')->sum('total');
        $inventory = (float) Item::where('track_inventory', true)->sum(DB::raw('stock_on_hand * purchase_price'));
        $inputTax = (float) $upTo($this->live('bill'))->sum('tax_total') + (float) $upTo(Expense::query())->sum('tax_amount');
        $payable = (float) $upTo($this->live('bill'))->sum('balance');
        $outputTax = (float) $upTo($this->live('invoice'))->sum('tax_total') - (float) $upTo($this->live('credit_note'))->sum('tax_total');

        $assets = [
            ['name' => 'Cash & Bank', 'amount' => round($cash, 2)],
            ['name' => 'Accounts Receivable', 'amount' => round($receivable, 2)],
            ['name' => 'Inventory', 'amount' => round($inventory, 2)],
            ['name' => 'Input Tax Credit', 'amount' => round($inputTax, 2)],
        ];
        $liabilities = [
            ['name' => 'Accounts Payable', 'amount' => round($payable, 2)],
            ['name' => 'Tax Payable', 'amount' => round($outputTax, 2)],
        ];
        $equity = [];

        $handled = ['cash', 'bank', 'receivable', 'payable', 'inventory', 'tax'];
        foreach ($accounts as $id => $a) {
            if (in_array($a->sub_type, $handled, true) || in_array($a->type, ['income', 'expense'], true)) {
                continue;
            }
            $net = $a->opening_balance + ($journal[$id] ?? 0) * ($a->type === 'asset' ? 1 : -1);
            if (! $net) {
                continue;
            }
            $row = ['name' => $a->name, 'amount' => round($net, 2)];
            match ($a->type) {
                'asset' => $assets[] = $row,
                'liability' => $liabilities[] = $row,
                default => $equity[] = $row,
            };
        }

        $totalAssets = round(array_sum(array_column($assets, 'amount')), 2);
        $totalLiabilities = round(array_sum(array_column($liabilities, 'amount')), 2);
        $equityBase = array_sum(array_column($equity, 'amount'));
        $equity[] = ['name' => 'Retained Earnings (computed)', 'amount' => round($totalAssets - $totalLiabilities - $equityBase, 2)];

        return [
            'as_of' => $asOf,
            'assets' => $assets, 'liabilities' => $liabilities, 'equity' => $equity,
            'total_assets' => $totalAssets,
            'total_liabilities' => $totalLiabilities,
            'total_equity' => round(array_sum(array_column($equity, 'amount')), 2),
        ];
    }

    public function aging(string $type): array
    {
        $today = today();
        $zero = ['current' => 0, '1_15' => 0, '16_30' => 0, '31_45' => 0, 'over_45' => 0];
        $buckets = $zero;
        $rows = [];

        $this->live($type)->where('balance', '>', 0)->with('contact:id,name')->get()
            ->each(function (Document $d) use (&$rows, &$buckets, $today, $zero) {
                $due = $d->due_date ?? $d->date;
                $days = $due->lt($today) ? (int) $due->diffInDays($today) : 0;
                $bucket = match (true) {
                    $days <= 0 => 'current',
                    $days <= 15 => '1_15',
                    $days <= 30 => '16_30',
                    $days <= 45 => '31_45',
                    default => 'over_45',
                };
                $rows[$d->contact_id] ??= array_merge(['contact_id' => $d->contact_id, 'name' => $d->contact?->name, 'total' => 0], $zero);
                $rows[$d->contact_id][$bucket] += $d->balance;
                $rows[$d->contact_id]['total'] += $d->balance;
                $buckets[$bucket] += $d->balance;
            });

        return [
            'rows' => array_values($rows),
            'totals' => array_merge($buckets, ['total' => array_sum($buckets)]),
        ];
    }

    public function salesByCustomer(string $from, string $to): array
    {
        return $this->between($this->live('invoice'), $from, $to)
            ->select('contact_id', DB::raw('COUNT(*) as invoices'), DB::raw('SUM(subtotal - discount) as sales'), DB::raw('SUM(total) as total'))
            ->groupBy('contact_id')->orderByDesc('total')->with('contact:id,name')->get()
            ->map(fn ($r) => [
                'contact_id' => $r->contact_id, 'name' => $r->contact?->name, 'invoices' => (int) $r->invoices,
                'sales' => round((float) $r->sales, 2), 'total' => round((float) $r->total, 2),
            ])->all();
    }

    public function salesByItem(string $from, string $to): array
    {
        return Document::query()
            ->join('document_items as di', 'di.document_id', '=', 'documents.id')
            ->where('documents.type', 'invoice')->whereNotIn('documents.status', self::LIVE)
            ->whereBetween('documents.date', [$from, $to])
            ->groupBy('di.item_id', 'di.name')
            ->select('di.item_id', 'di.name', DB::raw('SUM(di.quantity) as quantity'), DB::raw('SUM(di.amount) as amount'))
            ->orderByDesc('amount')->get()
            ->map(fn ($r) => [
                'item_id' => $r->item_id, 'name' => $r->name,
                'quantity' => round((float) $r->quantity, 3), 'amount' => round((float) $r->amount, 2),
                'average_price' => $r->quantity > 0 ? round($r->amount / $r->quantity, 2) : 0,
            ])->all();
    }

    public function taxSummary(string $from, string $to): array
    {
        $byRate = function (string $type) use ($from, $to) {
            return Document::query()
                ->join('document_items as di', 'di.document_id', '=', 'documents.id')
                ->where('documents.type', $type)->whereNotIn('documents.status', self::LIVE)
                ->whereBetween('documents.date', [$from, $to])
                ->groupBy('di.tax_rate')
                ->select('di.tax_rate', DB::raw('SUM(di.amount) as taxable'), DB::raw('SUM(di.tax_amount) as tax'))
                ->orderBy('di.tax_rate')->get()
                ->map(fn ($r) => ['rate' => (float) $r->tax_rate, 'taxable' => round((float) $r->taxable, 2), 'tax' => round((float) $r->tax, 2)])
                ->all();
        };

        $output = $byRate('invoice');
        $input = $byRate('bill');
        $expenseTax = (float) Expense::whereBetween('date', [$from, $to])->sum('tax_amount');
        $outTotal = array_sum(array_column($output, 'tax'));
        $inTotal = array_sum(array_column($input, 'tax')) + $expenseTax;

        return [
            'output' => $output, 'input' => $input, 'expense_tax' => round($expenseTax, 2),
            'output_total' => round($outTotal, 2), 'input_total' => round($inTotal, 2),
            'net_payable' => round($outTotal - $inTotal, 2),
        ];
    }

    public function inventoryValuation(): array
    {
        $rows = Item::where('track_inventory', true)->orderBy('name')
            ->get(['id', 'name', 'sku', 'unit', 'stock_on_hand', 'purchase_price', 'sales_price', 'reorder_level'])
            ->map(fn ($i) => array_merge($i->toArray(), [
                'value' => round($i->stock_on_hand * $i->purchase_price, 2),
                'low' => $i->stock_on_hand <= $i->reorder_level,
            ]));

        return ['rows' => $rows->all(), 'total_value' => round($rows->sum('value'), 2)];
    }

    public function contactStatement(Contact $contact, string $from, string $to): array
    {
        $isCustomer = $contact->type === 'customer';
        $docType = $isCustomer ? 'invoice' : 'bill';
        $entries = collect();

        $this->between($this->live($docType), $from, $to)->where('contact_id', $contact->id)->get()
            ->each(fn ($d) => $entries->push(['date' => $d->date->toDateString(), 'type' => $docType, 'number' => $d->number, 'debit' => $d->total, 'credit' => 0]));
        if ($isCustomer) {
            $this->between($this->live('credit_note'), $from, $to)->where('contact_id', $contact->id)->get()
                ->each(fn ($d) => $entries->push(['date' => $d->date->toDateString(), 'type' => 'credit_note', 'number' => $d->number, 'debit' => 0, 'credit' => $d->total]));
        }
        Payment::where('contact_id', $contact->id)->whereBetween('date', [$from, $to])->get()
            ->each(fn ($p) => $entries->push(['date' => $p->date->toDateString(), 'type' => 'payment', 'number' => $p->number, 'debit' => 0, 'credit' => $p->amount]));

        $balance = $contact->opening_balance;
        $rows = $entries->sortBy('date')->values()->map(function ($e) use (&$balance) {
            $balance += $e['debit'] - $e['credit'];

            return $e + ['balance' => round($balance, 2)];
        });

        return ['contact' => $contact->only(['id', 'name', 'type']), 'opening_balance' => $contact->opening_balance, 'rows' => $rows->all(), 'closing_balance' => round($balance, 2)];
    }

    /** Default report period: current financial year to date. */
    public static function period(?string $from, ?string $to, int $fyStartMonth = 4): array
    {
        $today = today();
        if (! $from) {
            $fy = Carbon::create($today->month >= $fyStartMonth ? $today->year : $today->year - 1, $fyStartMonth, 1);
            $from = $fy->toDateString();
        }

        return [$from, $to ?: $today->toDateString()];
    }
}
