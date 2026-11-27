<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LedgerService;
use App\Services\ReportService;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private ReportService $reports, private LedgerService $ledger) {}

    private function period(Request $request): array
    {
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        return ReportService::period($request->from, $request->to, $request->user()->organization->fiscal_year_start);
    }

    public function dashboard()
    {
        return $this->reports->dashboard();
    }

    public function profitLoss(Request $request)
    {
        return $this->reports->profitAndLoss(...$this->period($request));
    }

    public function balanceSheet(Request $request)
    {
        $request->validate(['as_of' => ['nullable', 'date']]);

        return $this->reports->balanceSheet($request->as_of ?: today()->toDateString());
    }

    public function receivables()
    {
        return $this->reports->aging('invoice');
    }

    public function payables()
    {
        return $this->reports->aging('bill');
    }

    public function salesByCustomer(Request $request)
    {
        return $this->reports->salesByCustomer(...$this->period($request));
    }

    public function salesByItem(Request $request)
    {
        return $this->reports->salesByItem(...$this->period($request));
    }

    public function taxSummary(Request $request)
    {
        return $this->reports->taxSummary(...$this->period($request));
    }

    public function vatReturn(Request $request)
    {
        return $this->reports->vatReturn(...$this->period($request));
    }

    public function inventory()
    {
        return $this->reports->inventoryValuation();
    }

    private function asOf(Request $request): string
    {
        $request->validate(['as_of' => ['nullable', 'date']]);

        return $request->as_of ?: today()->toDateString();
    }

    public function trialBalance(Request $request)
    {
        return $this->ledger->trialBalance($this->asOf($request));
    }

    public function generalLedger(Request $request)
    {
        $request->validate(['account_id' => ['nullable', 'integer']]);

        return $this->ledger->generalLedger(...[...$this->period($request), $request->integer('account_id') ?: null]);
    }

    public function dayBook(Request $request)
    {
        return $this->ledger->dayBook(...$this->period($request));
    }

    public function customerBalances(Request $request)
    {
        return $this->ledger->contactBalances('customer', $this->asOf($request));
    }

    public function vendorBalances(Request $request)
    {
        return $this->ledger->contactBalances('vendor', $this->asOf($request));
    }
}
