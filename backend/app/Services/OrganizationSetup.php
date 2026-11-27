<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Facades\DB;

/** Seeds a new organization with a standard chart of accounts and GST tax rates. */
class OrganizationSetup
{
    public const ACCOUNTS = [
        ['1000', 'Cash in Hand', 'asset', 'cash'],
        ['1010', 'Bank Account', 'asset', 'bank'],
        ['1100', 'Accounts Receivable', 'asset', 'receivable'],
        ['1200', 'Inventory Asset', 'asset', 'inventory'],
        ['1300', 'Input Tax Credit', 'asset', 'tax'],
        ['1500', 'Furniture & Equipment', 'asset', 'fixed_asset'],
        ['2000', 'Accounts Payable', 'liability', 'payable'],
        ['2100', 'GST Payable', 'liability', 'tax'],
        ['2200', 'Loans', 'liability', 'loan'],
        ['3000', "Owner's Equity", 'equity', 'equity'],
        ['3100', 'Retained Earnings', 'equity', 'equity'],
        ['4000', 'Sales', 'income', 'sales'],
        ['4100', 'Service Income', 'income', 'sales'],
        ['4900', 'Other Income', 'income', 'other_income'],
        ['5000', 'Cost of Goods Sold', 'expense', 'cogs'],
        ['5100', 'Rent', 'expense', 'expense'],
        ['5200', 'Salaries & Wages', 'expense', 'expense'],
        ['5300', 'Utilities', 'expense', 'expense'],
        ['5400', 'Office Supplies', 'expense', 'expense'],
        ['5500', 'Travel & Conveyance', 'expense', 'expense'],
        ['5600', 'Advertising & Marketing', 'expense', 'expense'],
        ['5700', 'Bank Charges', 'expense', 'expense'],
        ['5800', 'Internet & Telephone', 'expense', 'expense'],
        ['5900', 'Repairs & Maintenance', 'expense', 'expense'],
        ['5990', 'Miscellaneous Expenses', 'expense', 'expense'],
    ];

    public const TAXES = [
        ['GST 0%', 0], ['GST 5%', 5], ['GST 12%', 12], ['GST 18%', 18], ['GST 28%', 28],
    ];

    /** UAE VAT: 5% standard, zero-rated and exempt (type EXEMPT is reported in box 5 of the VAT return). */
    public const VAT_TAXES = [
        ['VAT 5%', 5, 'VAT'], ['Zero rated 0%', 0, 'VAT'], ['Exempt', 0, 'EXEMPT'],
    ];

    /**
     * Switch an organization's tax rates to its regime: creates the regime's standard rates
     * if missing, activates them and deactivates the other regime's rates (kept for old documents).
     */
    public function applyTaxRegime(Organization $org): void
    {
        $now = now();
        $taxes = DB::table('taxes')->where('organization_id', $org->id);
        if ($org->tax_regime === 'vat') {
            if (! (clone $taxes)->whereIn('type', ['VAT', 'EXEMPT'])->exists()) {
                DB::table('taxes')->insert(array_map(fn ($t) => [
                    'organization_id' => $org->id, 'name' => $t[0], 'rate' => $t[1], 'type' => $t[2],
                    'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                ], self::VAT_TAXES));
            }
            (clone $taxes)->whereIn('type', ['VAT', 'EXEMPT'])->update(['is_active' => true, 'updated_at' => $now]);
            (clone $taxes)->where('type', 'GST')->update(['is_active' => false, 'updated_at' => $now]);
        } elseif ($org->tax_regime === 'gst') {
            if (! (clone $taxes)->where('type', 'GST')->exists()) {
                $this->insertGst($org);
            }
            (clone $taxes)->where('type', 'GST')->update(['is_active' => true, 'updated_at' => $now]);
            (clone $taxes)->whereIn('type', ['VAT', 'EXEMPT'])->update(['is_active' => false, 'updated_at' => $now]);
        }
    }

    private function insertGst(Organization $org): void
    {
        $now = now();
        DB::table('taxes')->insert(array_map(fn ($t) => [
            'organization_id' => $org->id, 'name' => $t[0], 'rate' => $t[1], 'type' => 'GST',
            'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
        ], self::TAXES));
    }

    public function run(Organization $org): void
    {
        $now = now();
        DB::table('accounts')->insert(array_map(fn ($a) => [
            'organization_id' => $org->id, 'code' => $a[0], 'name' => $a[1], 'type' => $a[2],
            'sub_type' => $a[3], 'is_system' => true, 'is_active' => true, 'opening_balance' => 0,
            'created_at' => $now, 'updated_at' => $now,
        ], self::ACCOUNTS));

        if (($org->tax_regime ?? 'gst') === 'gst') {
            $this->insertGst($org);
        } else {
            $this->applyTaxRegime($org);
        }
    }
}
