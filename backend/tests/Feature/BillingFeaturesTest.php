<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\RecurringProfile;
use App\Models\Tax;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BillingFeaturesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
    }

    private function orgPayload(array $overrides = []): array
    {
        return array_merge(['name' => 'Sapphire Lights', 'currency' => 'AED', 'currency_symbol' => 'AED', 'fiscal_year_start' => 1], $overrides);
    }

    #[Test]
    public function switching_to_uae_vat_creates_vat_rates_and_hides_gst_rates(): void
    {
        $this->putJson('/api/organization', $this->orgPayload(['tax_regime' => 'vat', 'gstin' => '100123456700003']))
            ->assertOk()->assertJsonPath('tax_regime', 'vat');

        $active = Tax::where('is_active', true)->pluck('name')->all();
        $this->assertEqualsCanonicalizing(['VAT 5%', 'Zero rated 0%', 'Exempt'], $active);
        $this->getJson('/api/lookups')->assertJsonPath('tax_regime', 'vat')->assertJsonCount(3, 'taxes');

        // Switching back restores GST without duplicating VAT rates.
        $this->putJson('/api/organization', $this->orgPayload(['tax_regime' => 'gst']))->assertOk();
        $this->putJson('/api/organization', $this->orgPayload(['tax_regime' => 'vat']))->assertOk();
        $this->assertSame(1, Tax::where('name', 'VAT 5%')->count());
    }

    #[Test]
    public function vat_return_splits_standard_zero_rated_and_exempt_supplies(): void
    {
        $this->putJson('/api/organization', $this->orgPayload(['tax_regime' => 'vat']))->assertOk();
        $c = $this->customer();
        $v = $this->vendor();
        $vat = Tax::where('name', 'VAT 5%')->first();
        $zero = Tax::where('name', 'Zero rated 0%')->first();
        $exempt = Tax::where('name', 'Exempt')->first();
        $line = fn ($tax, $rate) => ['name' => 'Light', 'quantity' => 1, 'rate' => $rate, 'tax_id' => $tax->id];
        $doc = fn ($type, $contact, $lines) => $this->postJson('/api/documents', [
            'type' => $type, 'contact_id' => $contact->id, 'date' => today()->toDateString(), 'status' => $type === 'invoice' ? 'sent' : 'open', 'items' => $lines,
        ])->assertCreated();

        $doc('invoice', $c, [$line($vat, 1000), $line($zero, 400), $line($exempt, 100)]);
        $doc('credit_note', $c, [$line($vat, 200)]);
        $doc('bill', $v, [$line($vat, 600)]);
        $doc('vendor_credit', $v, [$line($vat, 100)]);

        $r = $this->getJson('/api/reports/vat-return?from='.today()->startOfMonth()->toDateString().'&to='.today()->toDateString())->assertOk();
        $r->assertJsonPath('supplies.0.amount', 800)->assertJsonPath('supplies.0.vat', 40)
            ->assertJsonPath('supplies.1.amount', 400)
            ->assertJsonPath('supplies.2.amount', 100)
            ->assertJsonPath('expenses_total.amount', 500)->assertJsonPath('expenses_total.vat', 25)
            ->assertJsonPath('net_vat', 15);
    }

    #[Test]
    public function custom_number_series_with_customer_code_shares_one_running_number(): void
    {
        $this->putJson('/api/organization', $this->orgPayload([
            'number_series' => ['invoice' => ['prefix' => 'INV-{YY}-{CODE}-', 'next' => 2630, 'digits' => 4]],
        ]))->assertOk();
        $tu = $this->customer(['name' => 'Tugboat Urban Interiors', 'company_name' => 'TUGBOAT URBAN INTERIORS L.L.C']);
        $pc = $this->customer(['name' => 'Petrochem', 'code' => 'pc']);
        $item = $this->goods();
        $yy = today()->format('y');

        $this->getJson("/api/documents/next-number?type=invoice&contact_id={$tu->id}")->assertJsonPath('number', "INV-$yy-TU-2630");
        $this->postJson('/api/documents', $this->invoicePayload($tu, $item))->assertCreated()->assertJsonPath('number', "INV-$yy-TU-2630");
        $this->postJson('/api/documents', $this->invoicePayload($pc, $item))->assertCreated()->assertJsonPath('number', "INV-$yy-PC-2631");

        // A hand-typed (imported) number ahead of the counter moves the counter past it.
        $this->postJson('/api/documents', $this->invoicePayload($pc, $item, ['number' => "INV-$yy-PC-2700"]))->assertCreated();
        $this->postJson('/api/documents', $this->invoicePayload($tu, $item))->assertJsonPath('number', "INV-$yy-TU-2701");

        // Other types keep the default style.
        $this->getJson('/api/documents/next-number?type=bill')->assertJsonPath('number', 'BILL-00001');
    }

    #[Test]
    public function vendor_credits_return_stock_and_reduce_payables(): void
    {
        $v = $this->vendor();
        $item = $this->goods(['stock_on_hand' => 10, 'track_inventory' => true]);
        $res = $this->postJson('/api/documents', [
            'type' => 'vendor_credit', 'contact_id' => $v->id, 'date' => today()->toDateString(), 'status' => 'open',
            'items' => [['item_id' => $item->id, 'name' => $item->name, 'quantity' => 3, 'rate' => 50]],
        ])->assertCreated()->assertJsonPath('number', 'VC-00001');

        $this->assertEquals(7, $item->fresh()->stock_on_hand);
        $this->postJson('/api/documents', ['type' => 'vendor_credit', 'contact_id' => $this->customer()->id, 'date' => today()->toDateString(), 'items' => [['name' => 'x', 'quantity' => 1, 'rate' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('contact_id');
        $this->assertSame('vendor_credit', $res->json('type'));
    }

    #[Test]
    public function delivery_challans_convert_to_invoices(): void
    {
        $c = $this->customer();
        $item = $this->goods(['stock_on_hand' => 10, 'track_inventory' => true]);
        $dc = $this->postJson('/api/documents', [
            'type' => 'delivery_challan', 'contact_id' => $c->id, 'date' => today()->toDateString(), 'status' => 'delivered',
            'items' => [['item_id' => $item->id, 'name' => $item->name, 'quantity' => 2, 'rate' => 100]],
        ])->assertCreated()->assertJsonPath('number', 'DC-00001')->json();
        $this->assertEquals(10, $item->fresh()->stock_on_hand); // a challan alone does not move stock

        $inv = $this->postJson("/api/documents/{$dc['id']}/convert")->assertCreated()->assertJsonPath('type', 'invoice')->json();
        $this->assertSame($dc['number'], $inv['reference']);
        $this->assertSame('invoiced', Document::find($dc['id'])->status);
    }

    #[Test]
    public function payment_terms_set_the_due_date(): void
    {
        $c = $this->customer();
        $item = $this->goods();
        $res = $this->postJson('/api/documents', $this->invoicePayload($c, $item, ['date' => '2026-11-10', 'due_date' => null, 'payment_terms' => 'Due end of next month']))
            ->assertCreated();
        $res->assertJsonPath('due_date', '2026-12-31')->assertJsonPath('payment_terms', 'Due end of next month');
        $this->assertSame('2026-11-25', Document::dueDateFor('Net 15', '2026-11-10'));
        $this->assertSame('2026-11-10', Document::dueDateFor('Due on receipt', '2026-11-10'));
    }

    #[Test]
    public function overdue_invoices_are_listed_and_reminders_are_recorded(): void
    {
        $c = $this->customer();
        $item = $this->goods();
        $id = $this->postJson('/api/documents', $this->invoicePayload($c, $item, ['date' => today()->subDays(40)->toDateString(), 'due_date' => today()->subDays(10)->toDateString()]))->json('id');
        $this->postJson('/api/documents', $this->invoicePayload($c, $item)); // not due yet

        $this->getJson('/api/documents/overdue')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.id', $id)->assertJsonPath('0.days_overdue', 10);
        $this->postJson("/api/documents/$id/reminded")->assertOk()->assertJsonPath('reminder_count', 1);
        $this->assertNotNull(Document::find($id)->reminded_at);
    }

    #[Test]
    public function recurring_invoice_profile_creates_due_invoices_and_catches_up(): void
    {
        Carbon::setTestNow('2026-11-27');
        $c = $this->customer();
        $item = $this->goods();
        $payload = [
            'type' => 'invoice', 'name' => 'Monthly AMC', 'contact_id' => $c->id, 'frequency' => 'month', 'interval' => 1,
            'start_date' => '2026-09-15', 'auto_send' => true, 'payment_terms' => 'Net 15',
            'items' => [['item_id' => $item->id, 'name' => 'AMC', 'quantity' => 1, 'rate' => 500, 'tax_id' => $this->tax(18)->id]],
        ];

        $p = $this->postJson('/api/recurring-profiles', $payload)->assertCreated();
        // Sep 15, Oct 15 and Nov 15 are due → three invoices, next run Dec 15.
        $p->assertJsonPath('next_date', '2026-12-15')->assertJsonPath('generated_count', 3)->assertJsonCount(3, 'documents');
        $docs = Document::where('recurring_profile_id', $p->json('id'))->orderBy('date')->get();
        $this->assertSame(['2026-09-15', '2026-10-15', '2026-11-15'], $docs->map(fn ($d) => $d->date->toDateString())->all());
        $this->assertSame('2026-09-30', $docs[0]->due_date->toDateString());
        $this->assertEquals(590, $docs[0]->total);

        // Nothing more until the next date; pausing and resuming skips missed runs.
        $this->postJson('/api/recurring-profiles/run')->assertJsonPath('created', 0);
        $this->postJson("/api/recurring-profiles/{$p->json('id')}/status", ['status' => 'paused'])->assertJsonPath('status', 'paused');
        Carbon::setTestNow('2027-02-20');
        $this->postJson('/api/recurring-profiles/run')->assertJsonPath('created', 0);
        $this->postJson("/api/recurring-profiles/{$p->json('id')}/status", ['status' => 'active'])->assertJsonPath('next_date', '2027-03-15');
        Carbon::setTestNow();
    }

    #[Test]
    public function recurring_profile_expires_after_its_end_date_and_bills_need_a_vendor(): void
    {
        Carbon::setTestNow('2026-11-27');
        $v = $this->vendor();
        $res = $this->postJson('/api/recurring-profiles', [
            'type' => 'bill', 'name' => 'Rent', 'contact_id' => $v->id, 'frequency' => 'week', 'start_date' => '2026-11-10', 'end_date' => '2026-11-20',
            'items' => [['name' => 'Rent', 'quantity' => 1, 'rate' => 100]],
        ])->assertCreated();
        $res->assertJsonPath('generated_count', 2)->assertJsonPath('status', 'expired');
        $this->assertSame('draft', Document::where('type', 'bill')->first()->status);

        $this->postJson('/api/recurring-profiles', [
            'type' => 'bill', 'name' => 'x', 'contact_id' => $this->customer()->id, 'frequency' => 'week', 'start_date' => '2026-11-10',
            'items' => [['name' => 'x', 'quantity' => 1, 'rate' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('contact_id');
        Carbon::setTestNow();
    }

    #[Test]
    public function daily_job_marks_past_due_invoices_overdue(): void
    {
        $c = $this->customer();
        $item = $this->goods();
        $id = $this->postJson('/api/documents', $this->invoicePayload($c, $item))->json('id');
        Document::whereKey($id)->update(['due_date' => today()->subDay()->toDateString()]);

        $this->artisan('billing:daily')->assertSuccessful();
        $this->assertSame('overdue', Document::find($id)->status);
    }

    #[Test]
    public function other_organizations_cannot_see_recurring_profiles(): void
    {
        $c = $this->customer();
        $id = $this->postJson('/api/recurring-profiles', [
            'type' => 'invoice', 'name' => 'Mine', 'contact_id' => $c->id, 'frequency' => 'month', 'start_date' => today()->addMonth()->toDateString(),
            'items' => [['name' => 'x', 'quantity' => 1, 'rate' => 1]],
        ])->assertCreated()->json('id');
        $this->assertSame(0, Document::count());

        $this->signIn();
        $this->getJson("/api/recurring-profiles/$id")->assertNotFound();
        $this->assertSame(0, RecurringProfile::count());
    }
}
