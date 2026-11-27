<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Contact;
use App\Models\Document;
use App\Models\Expense;
use App\Models\Journal;
use App\Models\Payment;
use Illuminate\Support\Collection;

/**
 * Double-entry view of the books, derived from transactions:
 *   invoice        Dr Receivable / Cr Sales, Cr Output tax      (credit note: reverse)
 *   bill           Dr Purchases, Dr Input tax / Cr Payable       (vendor credit: reverse)
 *   payment in     Dr Cash|Bank / Cr Receivable (Cr Customer advances for a retainer invoice)
 *   retainer apply Dr Customer advances / Cr Receivable
 *   payment out    Dr Payable / Cr Cash|Bank
 *   expense        Dr Expense, Dr Input tax / Cr Paid through
 *   journal        as entered
 *   opening        account and contact opening balances, balanced against Opening Balance Adjustments
 * Each entry: date, account_id, debit, credit, source, source_id, key (for bank reconciliation),
 * number, contact_id, contact, description.
 */
class LedgerService
{
    private const LIVE = ['draft', 'void'];

    /** @var array<string, Account> */
    private array $system = [];

    public function account(string $role): Account
    {
        return $this->system[$role] ??= match ($role) {
            'receivable' => $this->bySubType('receivable', ['1100', 'Accounts Receivable', 'asset']),
            'payable' => $this->bySubType('payable', ['2000', 'Accounts Payable', 'liability']),
            'cash' => $this->bySubType('cash', ['1000', 'Cash in Hand', 'asset']),
            'bank' => $this->bySubType('bank', ['1010', 'Bank Account', 'asset']),
            'sales' => $this->bySubType('sales', ['4000', 'Sales', 'income']),
            'purchases' => $this->bySubType('cogs', ['5000', 'Cost of Goods Sold', 'expense']),
            'input_tax' => Account::where('sub_type', 'tax')->where('type', 'asset')->orderBy('code')->first()
                ?? $this->create('1300', 'Input Tax Credit', 'asset', 'tax'),
            'output_tax' => Account::where('sub_type', 'tax')->where('type', 'liability')->orderBy('code')->first()
                ?? $this->create('2100', 'Tax Payable', 'liability', 'tax'),
            'advances' => $this->bySubType('advance', ['2300', 'Customer Advances', 'liability']),
            'opening' => $this->bySubType('opening', ['3200', 'Opening Balance Adjustments', 'equity']),
        };
    }

    private function bySubType(string $sub, array $make): Account
    {
        return Account::where('sub_type', $sub)->where('type', $make[2])->orderBy('code')->first()
            ?? $this->create($make[0], $make[1], $make[2], $sub);
    }

    /** System accounts are created the first time they are needed (older organizations lack some). */
    private function create(string $code, string $name, string $type, string $sub): Account
    {
        while (Account::where('code', $code)->exists()) {
            $code = (string) ((int) $code + 1);
        }

        return Account::create(['code' => $code, 'name' => $name, 'type' => $type, 'sub_type' => $sub, 'is_system' => true, 'is_active' => true, 'opening_balance' => 0]);
    }

    /** Cash or bank account a payment went through when none was chosen. */
    private function moneyAccount(?int $accountId, ?string $mode): int
    {
        return $accountId ?: $this->account($mode === 'cash' ? 'cash' : 'bank')->id;
    }

    /** All entries dated on or before $to (opening balances first), oldest first. */
    public function entries(string $to): Collection
    {
        $e = collect();
        $push = function (array $base, int $accountId, float $debit, float $credit) use ($e) {
            if (abs($debit) < 0.005 && abs($credit) < 0.005) {
                return;
            }
            if ($debit < 0 || $credit < 0) { // keep both columns positive
                [$debit, $credit] = [max(0, $debit) + max(0, -$credit), max(0, $credit) + max(0, -$debit)];
            }
            $e->push($base + ['account_id' => $accountId, 'debit' => round($debit, 2), 'credit' => round($credit, 2)]);
        };

        // Opening balances.
        $openingNet = 0.0;
        $base = ['date' => null, 'source' => 'opening', 'source_id' => 0, 'number' => '', 'contact_id' => null, 'contact' => null, 'description' => 'Opening balance'];
        foreach (Account::where('opening_balance', '!=', 0)->get() as $a) {
            $dr = in_array($a->type, ['asset', 'expense'], true);
            $push($base + ['key' => 'opening:'.$a->id], $a->id, $dr ? $a->opening_balance : 0, $dr ? 0 : $a->opening_balance);
            $openingNet += $dr ? $a->opening_balance : -$a->opening_balance;
        }
        foreach (Contact::where('opening_balance', '!=', 0)->get() as $c) {
            $isCustomer = $c->type === 'customer';
            $acc = $this->account($isCustomer ? 'receivable' : 'payable')->id;
            $b = ['contact_id' => $c->id, 'contact' => $c->name, 'key' => 'opening-contact:'.$c->id] + $base;
            $push($b, $acc, $isCustomer ? $c->opening_balance : 0, $isCustomer ? 0 : $c->opening_balance);
            $openingNet += $isCustomer ? $c->opening_balance : -$c->opening_balance;
        }
        if (abs($openingNet) >= 0.005) {
            $push($base + ['key' => 'opening:balance'], $this->account('opening')->id, $openingNet < 0 ? -$openingNet : 0, $openingNet > 0 ? $openingNet : 0);
        }

        // Invoices, credit notes, bills and vendor credits.
        $ar = $this->account('receivable')->id;
        $ap = $this->account('payable')->id;
        $sales = $this->account('sales')->id;
        $purch = $this->account('purchases')->id;
        $in = $this->account('input_tax')->id;
        $out = $this->account('output_tax')->id;
        Document::whereIn('type', ['invoice', 'credit_note', 'bill', 'vendor_credit'])->whereNotIn('status', self::LIVE)
            ->where('date', '<=', $to)->with('contact:id,name')
            ->get(['id', 'type', 'number', 'date', 'contact_id', 'total', 'tax_total', 'reference'])
            ->each(function (Document $d) use ($push, $ar, $ap, $sales, $purch, $in, $out) {
                $b = ['date' => $d->date->toDateString(), 'source' => $d->type, 'source_id' => $d->id, 'number' => $d->number,
                    'contact_id' => $d->contact_id, 'contact' => $d->contact?->name, 'description' => $d->reference, 'key' => 'document:'.$d->id];
                $net = $d->total - $d->tax_total;
                match ($d->type) {
                    'invoice' => [$push($b, $ar, $d->total, 0), $push($b, $sales, 0, $net), $push($b, $out, 0, $d->tax_total)],
                    'credit_note' => [$push($b, $sales, $net, 0), $push($b, $out, $d->tax_total, 0), $push($b, $ar, 0, $d->total)],
                    'bill' => [$push($b, $purch, $net, 0), $push($b, $in, $d->tax_total, 0), $push($b, $ap, 0, $d->total)],
                    'vendor_credit' => [$push($b, $ap, $d->total, 0), $push($b, $purch, 0, $net), $push($b, $in, 0, $d->tax_total)],
                };
            });

        // Payments.
        $adv = null;
        Payment::where('date', '<=', $to)->with(['contact:id,name', 'document:id,type'])->get()
            ->each(function (Payment $p) use ($push, $ar, $ap, &$adv) {
                $b = ['date' => $p->date->toDateString(), 'source' => 'payment', 'source_id' => $p->id, 'number' => $p->number,
                    'contact_id' => $p->contact_id, 'contact' => $p->contact?->name, 'description' => $p->reference, 'key' => 'payment:'.$p->id];
                if ($p->mode === Payment::RETAINER) {
                    $adv ??= $this->account('advances')->id;
                    $push($b, $adv, $p->amount, 0);
                    $push($b, $ar, 0, $p->amount);

                    return;
                }
                $money = $this->moneyAccount($p->account_id, $p->mode);
                if ($p->direction === 'in') {
                    $credit = $p->document?->type === 'retainer_invoice' ? ($adv ??= $this->account('advances')->id) : $ar;
                    $push($b, $money, $p->amount, 0);
                    $push($b, $credit, 0, $p->amount);
                } else {
                    $push($b, $ap, $p->amount, 0);
                    $push($b, $money, 0, $p->amount);
                }
            });

        // Expenses.
        Expense::where('date', '<=', $to)->with('contact:id,name')->get()
            ->each(function (Expense $x) use ($push, $in) {
                $b = ['date' => $x->date->toDateString(), 'source' => 'expense', 'source_id' => $x->id, 'number' => $x->reference ?? '',
                    'contact_id' => $x->contact_id, 'contact' => $x->contact?->name, 'description' => $x->description, 'key' => 'expense:'.$x->id];
                $push($b, $x->account_id, $x->amount, 0);
                $push($b, $in, $x->tax_amount, 0);
                $push($b, $x->paid_through_id ?: $this->account('cash')->id, 0, $x->total);
            });

        // Manual journals.
        Journal::where('date', '<=', $to)->with('lines')->get()
            ->each(function (Journal $j) use ($push) {
                foreach ($j->lines as $l) {
                    $push(['date' => $j->date->toDateString(), 'source' => 'journal', 'source_id' => $j->id, 'number' => $j->number,
                        'contact_id' => null, 'contact' => null, 'description' => $l->description ?: $j->notes, 'key' => 'journal_line:'.$l->id],
                        $l->account_id, (float) $l->debit, (float) $l->credit);
                }
            });

        return $e->sortBy(fn ($x) => ($x['date'] ?? '0000-00-00').'|'.$x['source'].'|'.str_pad((string) $x['source_id'], 10, '0', STR_PAD_LEFT))->values();
    }

    /** Net debit balance per account id as of a date. */
    public function balances(string $asOf): array
    {
        $b = [];
        foreach ($this->entries($asOf) as $x) {
            $b[$x['account_id']] = ($b[$x['account_id']] ?? 0) + $x['debit'] - $x['credit'];
        }

        return array_map(fn ($v) => round($v, 2), $b);
    }

    public function trialBalance(string $asOf): array
    {
        $balances = $this->balances($asOf);
        $accounts = Account::whereIn('id', array_keys($balances))->orderBy('code')->get();
        $rows = [];
        foreach ($accounts as $a) {
            $net = $balances[$a->id];
            if (abs($net) < 0.005) {
                continue;
            }
            $rows[] = ['account_id' => $a->id, 'code' => $a->code, 'name' => $a->name, 'type' => ucfirst($a->type),
                'debit' => $net > 0 ? $net : 0, 'credit' => $net < 0 ? -$net : 0];
        }
        $order = ['asset' => 1, 'liability' => 2, 'equity' => 3, 'income' => 4, 'expense' => 5];
        usort($rows, fn ($x, $y) => [$order[strtolower($x['type'])] ?? 9, $x['code']] <=> [$order[strtolower($y['type'])] ?? 9, $y['code']]);

        return ['as_of' => $asOf, 'rows' => $rows,
            'total_debit' => round(array_sum(array_column($rows, 'debit')), 2),
            'total_credit' => round(array_sum(array_column($rows, 'credit')), 2)];
    }

    /** Per account: opening balance at $from, entries in the period with a running balance, closing balance. */
    public function generalLedger(string $from, string $to, ?int $accountId = null): array
    {
        $groups = [];
        foreach ($this->entries($to) as $x) {
            if ($accountId && $x['account_id'] !== $accountId) {
                continue;
            }
            $g = &$groups[$x['account_id']];
            $g ??= ['opening' => 0.0, 'entries' => []];
            if ($x['date'] === null || $x['date'] < $from) {
                $g['opening'] += $x['debit'] - $x['credit'];
            } else {
                $g['entries'][] = $x;
            }
            unset($g);
        }
        $accounts = Account::whereIn('id', array_keys($groups))->orderBy('code')->get();
        $out = [];
        foreach ($accounts as $a) {
            $g = $groups[$a->id];
            $running = $g['opening'];
            $rows = array_map(function ($x) use (&$running) {
                $running += $x['debit'] - $x['credit'];

                return $x + ['balance' => round($running, 2)];
            }, $g['entries']);
            if (! $rows && abs($g['opening']) < 0.005) {
                continue;
            }
            $out[] = ['account_id' => $a->id, 'code' => $a->code, 'name' => $a->name, 'type' => $a->type,
                'opening' => round($g['opening'], 2), 'rows' => $rows,
                'debit' => round(array_sum(array_column($rows, 'debit')), 2), 'credit' => round(array_sum(array_column($rows, 'credit')), 2),
                'closing' => round($running, 2)];
        }

        return ['from' => $from, 'to' => $to, 'accounts' => $out];
    }

    /** Every posting in the period, grouped by transaction, in date order. */
    public function dayBook(string $from, string $to): array
    {
        $names = Account::pluck('name', 'id');
        $tx = [];
        foreach ($this->entries($to) as $x) {
            if ($x['date'] === null || $x['date'] < $from) {
                continue;
            }
            $k = $x['source'].':'.$x['source_id'];
            $tx[$k] ??= ['date' => $x['date'], 'source' => $x['source'], 'source_id' => $x['source_id'], 'number' => $x['number'],
                'contact' => $x['contact'], 'description' => $x['description'], 'lines' => [], 'amount' => 0.0];
            $tx[$k]['lines'][] = ['account' => $names[$x['account_id']] ?? '', 'debit' => $x['debit'], 'credit' => $x['credit']];
            $tx[$k]['amount'] = round($tx[$k]['amount'] + $x['debit'], 2);
        }

        return ['from' => $from, 'to' => $to, 'transactions' => array_values($tx),
            'total' => round(array_sum(array_column($tx, 'amount')), 2)];
    }

    /** Receivable (customers) or payable (vendors) per contact as of a date, with unused advances. */
    public function contactBalances(string $type, string $asOf): array
    {
        $acc = $this->account($type === 'customer' ? 'receivable' : 'payable')->id;
        $advances = $type === 'customer' ? $this->account('advances')->id : null;
        $rows = [];
        foreach ($this->entries($asOf) as $x) {
            if (! $x['contact_id'] || ($x['account_id'] !== $acc && $x['account_id'] !== $advances)) {
                continue;
            }
            $r = &$rows[$x['contact_id']];
            $r ??= ['contact_id' => $x['contact_id'], 'name' => $x['contact'], 'billed' => 0.0, 'paid' => 0.0, 'advance' => 0.0];
            if ($x['account_id'] === $advances) {
                $r['advance'] += $x['credit'] - $x['debit'];
            } elseif ($type === 'customer') {
                $r['billed'] += $x['debit'];
                $r['paid'] += $x['credit'];
            } else {
                $r['billed'] += $x['credit'];
                $r['paid'] += $x['debit'];
            }
            unset($r);
        }
        $rows = array_values(array_filter(array_map(fn ($r) => [
            'contact_id' => $r['contact_id'], 'name' => $r['name'],
            'billed' => round($r['billed'], 2), 'paid' => round($r['paid'], 2),
            'balance' => round($r['billed'] - $r['paid'], 2), 'advance' => round($r['advance'], 2),
        ], $rows), fn ($r) => abs($r['balance']) >= 0.005 || abs($r['advance']) >= 0.005));
        usort($rows, fn ($a, $b) => $b['balance'] <=> $a['balance']);

        return ['as_of' => $asOf, 'rows' => $rows,
            'total' => round(array_sum(array_column($rows, 'balance')), 2),
            'total_advance' => round(array_sum(array_column($rows, 'advance')), 2)];
    }
}
