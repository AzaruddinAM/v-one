<?php

namespace Tests\Feature;

use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
    }

    #[Test]
    public function it_creates_an_invoice_with_calculated_totals_and_sequential_number(): void
    {
        $c = $this->customer();
        $item = $this->goods(['stock_on_hand' => 10]);

        $res = $this->postJson('/api/documents', $this->invoicePayload($c, $item, ['discount' => 16]))->assertCreated();

        $res->assertJsonPath('number', 'INV-00001')
            ->assertJsonPath('subtotal', 200)
            ->assertJsonPath('tax_total', 36)
            ->assertJsonPath('total', 220)
            ->assertJsonPath('balance', 220)
            ->assertJsonPath('status', 'sent');

        $this->postJson('/api/documents', $this->invoicePayload($c, $item))->assertJsonPath('number', 'INV-00002');
        $this->getJson('/api/documents/next-number?type=invoice')->assertJsonPath('number', 'INV-00003');
    }

    #[Test]
    public function validation_requires_items_and_a_customer_for_sales(): void
    {
        $vendor = $this->vendor();
        $item = $this->goods();

        $this->postJson('/api/documents', $this->invoicePayload($vendor, $item, ['items' => []]))
            ->assertUnprocessable()->assertJsonValidationErrors(['contact_id', 'items']);
    }

    #[Test]
    public function sent_invoices_reduce_stock_but_drafts_do_not(): void
    {
        $c = $this->customer();
        $item = $this->goods(['stock_on_hand' => 10]);

        $draft = $this->postJson('/api/documents', $this->invoicePayload($c, $item, ['status' => 'draft']))->json();
        $this->assertEquals(10, $item->fresh()->stock_on_hand);

        $this->postJson("/api/documents/{$draft['id']}/status", ['status' => 'sent'])->assertOk();
        $this->assertEquals(8, $item->fresh()->stock_on_hand);

        // editing quantity re-syncs stock instead of double counting
        $payload = $this->invoicePayload($c, $item);
        unset($payload['type']);
        $payload['items'][0]['quantity'] = 5;
        $this->putJson("/api/documents/{$draft['id']}", $payload)->assertOk();
        $this->assertEquals(5, $item->fresh()->stock_on_hand);

        $this->postJson("/api/documents/{$draft['id']}/status", ['status' => 'void'])->assertOk();
        $this->assertEquals(10, $item->fresh()->stock_on_hand);
    }

    #[Test]
    public function bills_increase_stock(): void
    {
        $v = $this->vendor();
        $item = $this->goods(['stock_on_hand' => 1]);

        $payload = $this->invoicePayload($v, $item, ['type' => 'bill', 'status' => 'open']);
        $this->postJson('/api/documents', $payload)->assertCreated()->assertJsonPath('number', 'BILL-00001');

        $this->assertEquals(3, $item->fresh()->stock_on_hand);
    }

    #[Test]
    public function payments_update_invoice_balance_and_status(): void
    {
        $c = $this->customer();
        $inv = $this->postJson('/api/documents', $this->invoicePayload($c, $this->goods()))->json();

        $p1 = $this->postJson('/api/payments', [
            'direction' => 'in', 'contact_id' => $c->id, 'document_id' => $inv['id'],
            'date' => today()->toDateString(), 'amount' => 100, 'mode' => 'upi',
        ])->assertCreated()->assertJsonPath('number', 'PR-00001')->json();

        $doc = Document::find($inv['id']);
        $this->assertSame('partial', $doc->status);
        $this->assertEquals(136, $doc->balance);

        $this->postJson('/api/payments', [
            'direction' => 'in', 'contact_id' => $c->id, 'document_id' => $inv['id'],
            'date' => today()->toDateString(), 'amount' => 500, 'mode' => 'cash',
        ])->assertUnprocessable()->assertJsonValidationErrors('amount');

        $this->postJson('/api/payments', [
            'direction' => 'in', 'contact_id' => $c->id, 'document_id' => $inv['id'],
            'date' => today()->toDateString(), 'amount' => 136, 'mode' => 'cash',
        ])->assertCreated();
        $this->assertSame('paid', $doc->fresh()->status);

        $this->deleteJson("/api/payments/{$p1['id']}")->assertNoContent();
        $this->assertSame('partial', $doc->fresh()->status);
        $this->assertEquals(100, $doc->fresh()->balance);
    }

    #[Test]
    public function payments_cannot_be_recorded_on_drafts(): void
    {
        $c = $this->customer();
        $inv = $this->postJson('/api/documents', $this->invoicePayload($c, $this->goods(), ['status' => 'draft']))->json();

        $this->postJson('/api/payments', [
            'direction' => 'in', 'contact_id' => $c->id, 'document_id' => $inv['id'],
            'date' => today()->toDateString(), 'amount' => 10, 'mode' => 'cash',
        ])->assertUnprocessable()->assertJsonValidationErrors('document_id');
    }

    #[Test]
    public function overdue_status_is_derived_from_due_date(): void
    {
        $c = $this->customer();
        $res = $this->postJson('/api/documents', $this->invoicePayload($c, $this->goods(), [
            'date' => today()->subDays(40)->toDateString(), 'due_date' => today()->subDays(10)->toDateString(),
        ]));

        $res->assertJsonPath('status', 'overdue');
    }

    #[Test]
    public function an_estimate_can_be_converted_to_an_invoice(): void
    {
        $c = $this->customer();
        $est = $this->postJson('/api/documents', $this->invoicePayload($c, $this->goods(), ['type' => 'estimate']))
            ->assertJsonPath('number', 'EST-00001')->json();

        $this->postJson("/api/documents/{$est['id']}/convert")->assertCreated()
            ->assertJsonPath('type', 'invoice')
            ->assertJsonPath('total', 236)
            ->assertJsonPath('converted_from_id', $est['id'])
            ->assertJsonPath('reference', 'EST-00001');

        $this->assertSame('accepted', Document::find($est['id'])->status);
    }

    #[Test]
    public function listing_filters_by_type_status_and_search(): void
    {
        $c = $this->customer(['name' => 'Zebra Traders']);
        $item = $this->goods();
        $this->postJson('/api/documents', $this->invoicePayload($c, $item));
        $this->postJson('/api/documents', $this->invoicePayload($c, $item, ['status' => 'draft']));
        $this->postJson('/api/documents', $this->invoicePayload($c, $item, ['type' => 'estimate']));

        $this->getJson('/api/documents?type=invoice')->assertJsonPath('total', 2);
        $this->getJson('/api/documents?type=invoice&status=draft')->assertJsonPath('total', 1);
        $this->getJson('/api/documents?type=invoice&q=zebra')->assertJsonPath('total', 2);
        $this->getJson('/api/documents?type=invoice&q=nomatch')->assertJsonPath('total', 0);
    }

    #[Test]
    public function deleting_a_document_restores_stock_and_removes_payments(): void
    {
        $c = $this->customer();
        $item = $this->goods(['stock_on_hand' => 10]);
        $inv = $this->postJson('/api/documents', $this->invoicePayload($c, $item))->json();
        $this->postJson('/api/payments', [
            'direction' => 'in', 'contact_id' => $c->id, 'document_id' => $inv['id'],
            'date' => today()->toDateString(), 'amount' => 50, 'mode' => 'cash',
        ]);

        $this->deleteJson("/api/documents/{$inv['id']}")->assertNoContent();

        $this->assertEquals(10, $item->fresh()->stock_on_hand);
        $this->assertDatabaseCount('payments', 0);
    }
}
