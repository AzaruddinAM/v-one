<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Contact;
use App\Models\Expense;
use App\Models\Item;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Tax;
use App\Models\User;
use App\Services\DocumentService;
use App\Services\OrganizationSetup;
use App\Services\StockService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;

/**
 * Demo company so the app looks alive on first login.
 * Login: phone 9876543210 / password Admin@123
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $org = Organization::create([
            'name' => 'V-One Demo Traders', 'phone' => '9876543210', 'email' => 'accounts@vone.demo',
            'address' => '2nd Floor, MG Road', 'city' => 'Kasaragod', 'state' => 'Kerala', 'country' => 'India',
            'pincode' => '671121', 'gstin' => '32ABCDE1234F1Z5',
            'invoice_terms' => 'Payment due within the agreed credit period. Thank you for your business!',
        ]);
        app(OrganizationSetup::class)->run($org);

        $admin = User::create([
            'organization_id' => $org->id, 'name' => 'Admin', 'phone' => '9876543210',
            'email' => 'admin@vone.demo', 'password' => 'Admin@123', 'role' => 'admin',
        ]);
        Auth::setUser($admin);

        $gst18 = Tax::where('rate', 18)->first();
        $gst12 = Tax::where('rate', 12)->first();
        $gst5 = Tax::where('rate', 5)->first();

        $customers = collect([
            ['Anil Kumar', 'Kumar Electronics', 'Kochi'], ['Fathima Rahman', 'Rahman Stores', 'Kozhikode'],
            ['Suresh Nair', 'Nair & Sons', 'Thrissur'], ['Priya Menon', 'Menon Retail', 'Kannur'],
            ['Mohammed Ashraf', 'Ashraf Traders', 'Mangaluru'],
        ])->map(fn ($c, $i) => Contact::create([
            'type' => 'customer', 'name' => $c[0], 'company_name' => $c[1], 'city' => $c[2], 'state' => 'Kerala',
            'country' => 'India', 'phone' => '98470000'.str_pad((string) ($i + 10), 2, '0'), 'payment_terms' => 15 + $i * 5,
            'email' => strtolower(explode(' ', $c[0])[0]).'@example.com',
        ]));

        $vendors = collect([
            ['Ravi Wholesale', 'Ravi Wholesale Pvt Ltd', 'Bengaluru'],
            ['Malabar Distributors', 'Malabar Distributors', 'Kozhikode'],
            ['TechSupply Co', 'TechSupply India', 'Chennai'],
        ])->map(fn ($v) => Contact::create([
            'type' => 'vendor', 'name' => $v[0], 'company_name' => $v[1], 'city' => $v[2], 'country' => 'India', 'payment_terms' => 30,
        ]));

        $stock = app(StockService::class);
        $items = collect([
            ['Wireless Mouse', 'WM-100', 'goods', 'pcs', 650, 420, $gst18, 90],
            ['Mechanical Keyboard', 'KB-200', 'goods', 'pcs', 2450, 1700, $gst18, 60],
            ['27" LED Monitor', 'MN-270', 'goods', 'pcs', 14500, 11200, $gst18, 40],
            ['A4 Paper Ream', 'PP-A4', 'goods', 'box', 320, 240, $gst12, 120],
            ['Basmati Rice 5kg', 'RC-5K', 'goods', 'pack', 540, 430, $gst5, 60],
            ['Annual Maintenance', 'SRV-AMC', 'service', 'nos', 12000, 0, $gst18, 0],
            ['Installation Service', 'SRV-INS', 'service', 'hrs', 800, 0, $gst18, 0],
        ])->map(function ($i) use ($stock) {
            $item = Item::create([
                'name' => $i[0], 'sku' => $i[1], 'type' => $i[2], 'unit' => $i[3], 'sales_price' => $i[4],
                'purchase_price' => $i[5], 'tax_id' => $i[6]?->id, 'track_inventory' => $i[2] === 'goods',
                'reorder_level' => $i[2] === 'goods' ? 5 : 0, 'category' => $i[2] === 'goods' ? 'Products' : 'Services',
            ]);
            if ($item->track_inventory) {
                $stock->adjust($item, $i[7], now()->subMonths(6)->toDateString(), 'Opening stock');
            }

            return $item;
        });

        Account::where('sub_type', 'bank')->update(['opening_balance' => 750000]);
        Account::where('sub_type', 'cash')->update(['opening_balance' => 50000]);
        Account::where('code', '3000')->update(['opening_balance' => 800000]);

        $docs = app(DocumentService::class);
        $line = fn (Item $it, $qty) => [
            'item_id' => $it->id, 'name' => $it->name, 'quantity' => $qty, 'unit' => $it->unit,
            'rate' => $it->sales_price, 'tax_id' => $it->tax_id, 'discount_percent' => 0,
        ];

        // Invoices spread over the last 6 months
        for ($m = 5; $m >= 0; $m--) {
            foreach ($customers->shuffle()->take(3) as $k => $customer) {
                $date = now()->subMonths($m)->startOfMonth()->addDays(3 + $k * 7);
                if ($date->isFuture()) {
                    $date = now()->subDays($k);
                }
                $inv = $docs->save([
                    'type' => 'invoice', 'contact_id' => $customer->id, 'status' => 'sent',
                    'date' => $date->toDateString(), 'due_date' => $date->copy()->addDays($customer->payment_terms)->toDateString(),
                    'terms' => $org->invoice_terms,
                    'items' => $items->random(rand(1, 3))->map(fn ($it) => $line($it, rand(1, 4)))->values()->all(),
                ]);
                if ($m >= 1) {
                    $amount = $m >= 2 ? $inv->total : round($inv->total / 2, 2);
                    Payment::create([
                        'direction' => 'in', 'number' => 'PR-'.str_pad((string) $inv->id, 5, '0', STR_PAD_LEFT),
                        'contact_id' => $customer->id, 'document_id' => $inv->id, 'date' => $date->copy()->addDays(10)->toDateString(),
                        'amount' => $amount, 'mode' => ['upi', 'bank_transfer', 'cash'][rand(0, 2)],
                    ]);
                    $docs->refreshPaymentStatus($inv);
                }
            }
        }

        // Bills from vendors
        foreach ($vendors as $i => $vendor) {
            $date = now()->subMonths(2 - $i)->startOfMonth()->addDays(5);
            $bill = $docs->save([
                'type' => 'bill', 'contact_id' => $vendor->id, 'status' => 'open', 'reference' => 'VB-'.(1001 + $i),
                'date' => $date->toDateString(), 'due_date' => $date->copy()->addDays(30)->toDateString(),
                'items' => $items->where('type', 'goods')->random(2)->map(fn ($it) => array_merge($line($it, 10), ['rate' => $it->purchase_price]))->values()->all(),
            ]);
            if ($i === 0) {
                Payment::create([
                    'direction' => 'out', 'number' => 'PM-00001', 'contact_id' => $vendor->id, 'document_id' => $bill->id,
                    'date' => $date->copy()->addDays(12)->toDateString(), 'amount' => $bill->total, 'mode' => 'bank_transfer',
                ]);
                $docs->refreshPaymentStatus($bill);
            }
        }

        // Estimate + sales order
        $docs->save([
            'type' => 'estimate', 'contact_id' => $customers[0]->id, 'status' => 'sent',
            'date' => now()->subDays(3)->toDateString(), 'due_date' => now()->addDays(12)->toDateString(),
            'items' => [$line($items[2], 2), $line($items[6], 3)],
        ]);
        $docs->save([
            'type' => 'purchase_order', 'contact_id' => $vendors[2]->id, 'status' => 'open',
            'date' => now()->subDays(1)->toDateString(),
            'items' => [array_merge($line($items[2], 5), ['rate' => $items[2]->purchase_price])],
        ]);

        // Expenses
        $bank = Account::where('sub_type', 'bank')->first();
        foreach (['Rent' => 25000, 'Salaries & Wages' => 60000, 'Utilities' => 4200, 'Internet & Telephone' => 1800] as $name => $amt) {
            $acc = Account::where('name', $name)->first();
            for ($m = 3; $m >= 0; $m--) {
                Expense::create([
                    'date' => now()->subMonths($m)->startOfMonth()->addDays(1)->toDateString(), 'account_id' => $acc->id,
                    'paid_through_id' => $bank->id, 'amount' => $amt, 'tax_amount' => 0, 'total' => $amt,
                    'description' => $name.' for '.now()->subMonths($m)->format('M Y'),
                ]);
            }
        }

        Auth::forgetUser();
    }
}
