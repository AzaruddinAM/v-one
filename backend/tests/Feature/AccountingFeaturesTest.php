<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AccountingFeaturesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
    }

    private function doc(string $type, int $contactId, float $rate, ?int $taxId = null, array $extra = []): array
    {
        return $this->postJson('/api/documents', $extra + [
            'type' => $type, 'contact_id' => $contactId, 'date' => today()->toDateString(),
            'status' => in_array($type, ['invoice', 'retainer_invoice'], true) ? 'sent' : 'open',
            'items' => [['name' => 'Chandelier', 'quantity' => 1, 'rate' => $rate, 'tax_id' => $taxId]],
        ])->assertCreated()->json();
    }

    private function pay(string $dir, int $contactId, ?int $docId, float $amount, string $mode = 'bank_transfer', array $extra = []): array
    {
        return $this->postJson('/api/payments', $extra + [
            'direction' => $dir, 'contact_id' => $contactId, 'document_id' => $docId,
            'date' => today()->toDateString(), 'amount' => $amount, 'mode' => $mode,
        ])->assertCreated()->json();
    }

    #[Test]
    public function trial_balance_balances_and_ledgers_follow_transactions(): void
    {
        $c = $this->customer();
        $v = $this->vendor();
        $gst = $this->tax(18);
        $inv = $this->doc('invoice', $c->id, 1000, $gst->id);
        $this->doc('bill', $v->id, 500, $gst->id);
        $this->pay('in', $c->id, $inv['id'], 700);
        $this->doc('credit_note', $c->id, 100);

        $tb = $this->getJson('/api/reports/trial-balance')->assertOk()->json();
        $this->assertEqualsWithDelta($tb['total_debit'], $tb['total_credit'], 0.001);
        $this->assertGreaterThan(0, $tb['total_debit']);
        $byName = collect($tb['rows'])->keyBy('name');
        $this->assertEquals(1180 - 700 - 100, $byName['Accounts Receivable']['debit']);
        $this->assertEquals(590, $byName['Accounts Payable']['credit']);

        $gl = $this->getJson('/api/reports/general-ledger')->assertOk()->json('accounts');
        $ar = collect($gl)->firstWhere('name', 'Accounts Receivable');
        $this->assertEquals(380, $ar['closing']);
        $this->assertCount(3, $ar['rows']);
        $this->assertEquals(380, end($ar['rows'])['balance']);

        $day = $this->getJson('/api/reports/day-book')->assertOk()->json();
        $this->assertCount(4, $day['transactions']);

        $this->getJson('/api/reports/customer-balances')->assertOk()
            ->assertJsonPath('rows.0.name', $c->name)->assertJsonPath('rows.0.balance', 380);
        $this->getJson('/api/reports/vendor-balances')->assertOk()->assertJsonPath('total', 590);
    }

    #[Test]
    public function opening_balances_are_balanced_against_an_adjustment_account(): void
    {
        $this->customer(['opening_balance' => 250]);
        Account::where('sub_type', 'bank')->first()?->update(['opening_balance' => 1000]);

        $tb = $this->getJson('/api/reports/trial-balance')->assertOk()->json();
        $this->assertEqualsWithDelta($tb['total_debit'], $tb['total_credit'], 0.001);
        $this->assertNotNull(collect($tb['rows'])->firstWhere('name', 'Opening Balance Adjustments'));
    }

    #[Test]
    public function bank_reconciliation_only_saves_when_the_difference_is_zero(): void
    {
        $c = $this->customer();
        $inv = $this->doc('invoice', $c->id, 1000);
        $p1 = $this->pay('in', $c->id, $inv['id'], 600);
        $this->pay('in', $c->id, $inv['id'], 400);

        $accounts = $this->getJson('/api/banking/accounts')->assertOk()->json();
        $bank = collect($accounts)->firstWhere('sub_type', 'bank');
        $this->assertEquals(1000, $bank['balance']);
        $this->assertEquals(2, $bank['uncleared']);

        $tx = $this->getJson("/api/banking/accounts/{$bank['id']}/transactions")->assertOk()->json();
        $this->assertCount(2, $tx['rows']);
        $key = 'payment:'.$p1['id'];

        $this->postJson("/api/banking/accounts/{$bank['id']}/reconcile", [
            'statement_date' => today()->toDateString(), 'statement_balance' => 1000, 'keys' => [$key],
        ])->assertUnprocessable()->assertJsonValidationErrors('statement_balance');

        $rec = $this->postJson("/api/banking/accounts/{$bank['id']}/reconcile", [
            'statement_date' => today()->toDateString(), 'statement_balance' => 600, 'keys' => [$key],
        ])->assertCreated()->json();

        $this->getJson("/api/banking/accounts/{$bank['id']}/transactions?uncleared=1")->assertJsonCount(1, 'rows')
            ->assertJsonPath('cleared_balance', 600);
        $this->postJson("/api/banking/accounts/{$bank['id']}/reconcile", [
            'statement_date' => today()->toDateString(), 'statement_balance' => 600, 'keys' => [$key],
        ])->assertUnprocessable();

        $this->deleteJson("/api/banking/reconciliations/{$rec['id']}")->assertNoContent();
        $this->getJson("/api/banking/accounts/{$bank['id']}/transactions?uncleared=1")->assertJsonCount(2, 'rows');
    }

    #[Test]
    public function lock_date_blocks_changes_to_older_transactions(): void
    {
        $c = $this->customer();
        $old = $this->doc('invoice', $c->id, 500, null, ['date' => today()->subDays(10)->toDateString()]);

        $this->putJson('/api/organization/lock-date', ['lock_date' => today()->subDays(5)->toDateString()])
            ->assertOk()->assertJsonPath('lock_date', today()->subDays(5)->toDateString());

        // Creating, editing and deleting inside the locked period fail.
        $this->postJson('/api/documents', [
            'type' => 'invoice', 'contact_id' => $c->id, 'date' => today()->subDays(6)->toDateString(), 'status' => 'sent',
            'items' => [['name' => 'X', 'quantity' => 1, 'rate' => 10]],
        ])->assertUnprocessable()->assertJsonValidationErrors('date');
        $this->deleteJson("/api/documents/{$old['id']}")->assertUnprocessable();

        // A payment today against the old invoice is fine: only its paid status changes.
        $this->pay('in', $c->id, $old['id'], 500);
        $this->assertSame('paid', Document::find($old['id'])->status);
    }

    #[Test]
    public function payments_inside_the_locked_period_are_rejected(): void
    {
        $c = $this->customer();
        $this->putJson('/api/organization/lock-date', ['lock_date' => today()->subDay()->toDateString()])->assertOk();
        $this->postJson('/api/payments', [
            'direction' => 'in', 'contact_id' => $c->id, 'date' => today()->subDays(3)->toDateString(), 'amount' => 10, 'mode' => 'cash',
        ])->assertUnprocessable()->assertJsonValidationErrors('date');

        $this->putJson('/api/organization/lock-date', ['lock_date' => null])->assertOk()->assertJsonPath('lock_date', null);
        $this->postJson('/api/payments', [
            'direction' => 'in', 'contact_id' => $c->id, 'date' => today()->subDays(3)->toDateString(), 'amount' => 10, 'mode' => 'cash',
        ])->assertCreated();
    }

    #[Test]
    public function only_admins_can_set_the_lock_date(): void
    {
        $this->signIn('staff');
        $this->putJson('/api/organization/lock-date', ['lock_date' => today()->toDateString()])->assertForbidden();
    }

    #[Test]
    public function retainer_payment_is_an_advance_until_applied_to_an_invoice(): void
    {
        $c = $this->customer();
        $gst = $this->tax(18);
        $ret = $this->doc('retainer_invoice', $c->id, 2000, $gst->id);
        $this->assertStringStartsWith('RET-', $ret['number']);
        $this->assertEquals(2000, $ret['total']); // advances carry no tax
        $this->pay('in', $c->id, $ret['id'], 2000);
        $this->assertSame('paid', Document::find($ret['id'])->status);

        $this->getJson('/api/reports/customer-balances')->assertJsonPath('rows.0.balance', 0)->assertJsonPath('rows.0.advance', 2000);
        $bs = $this->getJson('/api/reports/balance-sheet')->json();
        $this->assertEquals(2000, collect($bs['liabilities'])->firstWhere('name', 'Customer Advances')['amount']);

        $inv = $this->doc('invoice', $c->id, 1500, $gst->id); // 1770
        $this->getJson("/api/documents/{$ret['id']}/retainer")->assertOk()
            ->assertJsonPath('unapplied', 2000)->assertJsonCount(1, 'invoices');

        $this->postJson("/api/documents/{$ret['id']}/apply-retainer", ['invoice_id' => $inv['id'], 'amount' => 1800])
            ->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->postJson("/api/documents/{$ret['id']}/apply-retainer", ['invoice_id' => $inv['id'], 'amount' => 1770])
            ->assertCreated()->assertJsonPath('applied', 1770)->assertJsonPath('unapplied', 230);
        $this->assertSame('paid', Document::find($inv['id'])->status);

        $this->getJson('/api/reports/customer-balances')->assertJsonPath('rows.0.advance', 230);
        $tb = $this->getJson('/api/reports/trial-balance')->json();
        $this->assertEqualsWithDelta($tb['total_debit'], $tb['total_credit'], 0.001);
        $this->assertEquals(2000, collect($this->getJson('/api/banking/accounts')->json())->firstWhere('sub_type', 'bank')['balance']);

        // The retainer receipt can't be deleted while it is applied.
        $receipt = \App\Models\Payment::where('document_id', $ret['id'])->first();
        $this->deleteJson("/api/payments/{$receipt->id}")->assertUnprocessable();

        // Other customers' invoices are refused.
        $other = $this->doc('invoice', $this->customer()->id, 100);
        $this->postJson("/api/documents/{$ret['id']}/apply-retainer", ['invoice_id' => $other['id'], 'amount' => 50])
            ->assertUnprocessable()->assertJsonValidationErrors('invoice_id');
    }
}
