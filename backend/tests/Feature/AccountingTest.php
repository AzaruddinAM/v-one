<?php

namespace Tests\Feature;

use App\Models\Account;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AccountingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
    }

    #[Test]
    public function journals_must_balance(): void
    {
        $cash = Account::where('sub_type', 'cash')->first();
        $equity = Account::where('code', '3000')->first();

        $this->postJson('/api/journals', ['date' => today()->toDateString(), 'lines' => [
            ['account_id' => $cash->id, 'debit' => 100], ['account_id' => $equity->id, 'credit' => 90],
        ]])->assertUnprocessable()->assertJsonValidationErrors('lines');

        $this->postJson('/api/journals', ['date' => today()->toDateString(), 'lines' => [
            ['account_id' => $cash->id, 'debit' => 100], ['account_id' => $equity->id, 'credit' => 100],
        ]])->assertCreated()->assertJsonPath('number', 'JV-00001')->assertJsonPath('total', 100);
    }

    #[Test]
    public function expenses_compute_tax_and_must_use_expense_accounts(): void
    {
        $rent = Account::where('name', 'Rent')->first();
        $bank = Account::where('sub_type', 'bank')->first();

        $this->postJson('/api/expenses', [
            'date' => today()->toDateString(), 'account_id' => $rent->id, 'paid_through_id' => $bank->id,
            'amount' => 1000, 'tax_id' => $this->tax(18)->id,
        ])->assertCreated()->assertJsonPath('tax_amount', 180)->assertJsonPath('total', 1180);

        $this->postJson('/api/expenses', [
            'date' => today()->toDateString(), 'account_id' => $bank->id, 'amount' => 10,
        ])->assertUnprocessable()->assertJsonValidationErrors('account_id');
    }

    #[Test]
    public function system_accounts_cannot_be_deleted(): void
    {
        $acc = Account::where('is_system', true)->first();
        $this->deleteJson("/api/accounts/{$acc->id}")->assertStatus(422);

        $custom = $this->postJson('/api/accounts', ['code' => '6000', 'name' => 'Donations', 'type' => 'expense'])->assertCreated()->json();
        $this->deleteJson("/api/accounts/{$custom['id']}")->assertNoContent();
    }

    #[Test]
    public function profit_and_loss_and_dashboard_reflect_transactions(): void
    {
        $c = $this->customer();
        $item = $this->goods();
        $this->postJson('/api/documents', $this->invoicePayload($c, $item)); // 200 + 36 tax
        $this->postJson('/api/documents', $this->invoicePayload($c, $item, ['status' => 'draft'])); // ignored
        $this->postJson('/api/expenses', [
            'date' => today()->toDateString(), 'account_id' => Account::where('name', 'Rent')->value('id'), 'amount' => 50,
        ]);

        $from = today()->startOfYear()->toDateString();
        $this->getJson("/api/reports/profit-loss?from={$from}")->assertOk()
            ->assertJsonPath('total_income', 200)
            ->assertJsonPath('total_expenses', 50)
            ->assertJsonPath('net_profit', 150);

        $this->getJson('/api/reports/dashboard')->assertOk()
            ->assertJsonPath('receivable', 236)
            ->assertJsonCount(12, 'trend')
            ->assertJsonPath('counts.customers', 1);

        $this->getJson("/api/reports/tax-summary?from={$from}")->assertJsonPath('output_total', 36);
        $this->getJson('/api/reports/receivables')->assertJsonPath('totals.total', 236);
        $this->getJson('/api/reports/balance-sheet')->assertOk()->assertJsonStructure(['assets', 'liabilities', 'equity', 'total_assets']);
    }

    #[Test]
    public function stock_can_be_adjusted_manually(): void
    {
        $item = $this->goods(['stock_on_hand' => 2]);

        $this->postJson("/api/items/{$item->id}/adjust-stock", ['quantity' => 5, 'date' => today()->toDateString(), 'notes' => 'Found'])
            ->assertOk()->assertJsonPath('stock_on_hand', 7);
        $this->getJson("/api/items/{$item->id}/movements")->assertJsonPath('total', 1);
    }

    #[Test]
    public function items_with_opening_stock_and_unique_sku(): void
    {
        $this->postJson('/api/items', ['name' => 'Pen', 'sku' => 'PEN-1', 'type' => 'goods', 'sales_price' => 10, 'track_inventory' => true, 'opening_stock' => 25])
            ->assertCreated()->assertJsonPath('stock_on_hand', 25);
        $this->postJson('/api/items', ['name' => 'Pen 2', 'sku' => 'PEN-1', 'type' => 'goods', 'sales_price' => 10])
            ->assertUnprocessable()->assertJsonValidationErrors('sku');
    }
}
