<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Contact;
use App\Models\Document;
use App\Models\Item;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini.key' => 'test-key']);
        $this->signIn();
    }

    private function geminiReturns(array ...$contents): void
    {
        $seq = Http::sequence();
        foreach ($contents as $c) {
            $seq->push(['candidates' => [['content' => ['role' => 'model', 'parts' => $c]]]]);
        }
        Http::fake(['generativelanguage.googleapis.com/*' => $seq]);
    }

    private function billJson(array $overrides = []): array
    {
        return [['text' => json_encode(array_merge([
            'is_bill' => true,
            'document_kind' => 'tax_invoice',
            'vendor' => ['name' => 'Sharma Traders', 'gstin' => '27AAAPL1234C1ZV', 'city' => 'Pune'],
            'bill_number' => 'ST/2026/88',
            'bill_date' => '2026-10-20',
            'items' => [
                ['name' => 'A4 Paper Ream', 'quantity' => 10, 'unit' => 'pcs', 'rate' => 250, 'tax_rate' => 18],
                ['name' => 'Stapler', 'quantity' => 2, 'rate' => 120, 'tax_rate' => 12],
            ],
            'subtotal' => 2740, 'tax_total' => 478.8, 'total' => 3218.8,
            'suggested_category' => 'Office Supplies', 'confidence' => 0.92,
        ], $overrides))]];
    }

    #[Test]
    public function status_reports_whether_gemini_is_configured(): void
    {
        $this->getJson('/api/ai/status')->assertOk()->assertJsonPath('enabled', true);
        config(['services.gemini.key' => '']);
        $this->getJson('/api/ai/status')->assertJsonPath('enabled', false);
    }

    #[Test]
    public function scanning_a_bill_returns_a_matched_preview_without_saving_anything(): void
    {
        $vendor = $this->vendor(['name' => 'Sharma Traders']);
        $item = $this->goods(['name' => 'A4 Paper Ream']);
        $this->geminiReturns($this->billJson());

        $res = $this->post('/api/ai/scan-bill', ['file' => UploadedFile::fake()->image('bill.jpg')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('target', 'bill')
            ->assertJsonPath('vendor.id', $vendor->id)
            ->assertJsonPath('reference', 'ST/2026/88')
            ->assertJsonPath('date', '2026-10-20')
            ->assertJsonPath('items.0.item_id', $item->id)
            ->assertJsonPath('items.0.tax_id', $this->tax(18)->id)
            ->assertJsonPath('items.1.item_id', null)
            ->assertJsonPath('items.1.tax_id', $this->tax(12)->id)
            ->assertJsonPath('extracted.total', 3218.8);

        $this->assertSame(Account::where('name', 'Office Supplies')->value('id'), $res->json('expense.account_id'));
        $this->assertSame(0, Document::count());
        Http::assertSent(fn ($r) => $r->hasHeader('x-goog-api-key', 'test-key') && str_contains($r->url(), ':generateContent'));
    }

    #[Test]
    public function scan_rejects_unsupported_files_and_missing_key(): void
    {
        $this->post('/api/ai/scan-bill', ['file' => UploadedFile::fake()->create('notes.txt', 3, 'text/plain')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('file');

        config(['services.gemini.key' => '']);
        $this->post('/api/ai/scan-bill', ['file' => UploadedFile::fake()->image('bill.png')], ['Accept' => 'application/json'])
            ->assertStatus(503);
    }

    #[Test]
    public function confirming_a_preview_creates_vendor_items_and_an_open_bill(): void
    {
        $paper = $this->goods(['name' => 'A4 Paper Ream', 'track_inventory' => true, 'stock_on_hand' => 5]);

        $res = $this->postJson('/api/ai/import-bill', [
            'target' => 'bill',
            'reference' => 'ST/2026/88',
            'date' => '2026-10-20',
            'status' => 'open',
            'vendor' => ['name' => 'Sharma Traders', 'gstin' => '27AAAPL1234C1ZV'],
            'items' => [
                ['item_id' => $paper->id, 'name' => 'A4 Paper Ream', 'quantity' => 10, 'rate' => 250, 'tax_id' => $this->tax(18)->id],
                ['name' => 'Stapler', 'quantity' => 2, 'rate' => 120, 'tax_id' => $this->tax(12)->id, 'create_item' => true],
            ],
        ])->assertCreated()
            ->assertJsonPath('type', 'bill')
            ->assertJsonPath('created.vendor', true)
            ->assertJsonPath('created.items', 1)
            ->assertJsonPath('record.status', 'open')
            ->assertJsonPath('record.reference', 'ST/2026/88')
            ->assertJsonPath('record.total', 3218.8);

        $this->assertSame('BILL-00001', $res->json('record.number'));
        $this->assertTrue(Contact::where('type', 'vendor')->where('gstin', '27AAAPL1234C1ZV')->exists());
        $this->assertTrue(Item::where('name', 'Stapler')->where('purchase_price', 120)->exists());
        $this->assertEquals(15, $paper->fresh()->stock_on_hand);
    }

    #[Test]
    public function confirming_as_expense_creates_an_expense(): void
    {
        $account = Account::where('name', 'Utilities')->first();

        $this->postJson('/api/ai/import-bill', [
            'target' => 'expense',
            'date' => '2026-10-21',
            'reference' => 'EB-4411',
            'expense' => ['account_id' => $account->id, 'amount' => 1000, 'tax_id' => $this->tax(18)->id, 'description' => 'Electricity'],
        ])->assertCreated()->assertJsonPath('type', 'expense')->assertJsonPath('record.total', 1180);
    }

    #[Test]
    public function bill_import_requires_a_vendor_and_lines(): void
    {
        $this->postJson('/api/ai/import-bill', ['target' => 'bill', 'date' => '2026-10-20', 'vendor' => ['name' => ''], 'items' => []])
            ->assertUnprocessable()->assertJsonValidationErrors(['vendor.name', 'items']);
    }

    #[Test]
    public function chat_answers_using_live_business_data_through_function_calls(): void
    {
        $c = $this->customer(['name' => 'Ravi Stores']);
        $this->postJson('/api/documents', $this->invoicePayload($c, $this->goods(['stock_on_hand' => 10])))->assertCreated();

        $this->geminiReturns(
            [['functionCall' => ['name' => 'list_documents', 'args' => ['type' => 'invoice', 'unpaid_only' => true]]]],
            [['text' => 'You have **1 unpaid invoice** worth ₹236.00.']],
        );

        $this->postJson('/api/ai/chat', ['messages' => [['role' => 'user', 'text' => 'How many unpaid invoices?']]])
            ->assertOk()
            ->assertJsonPath('reply', 'You have **1 unpaid invoice** worth ₹236.00.')
            ->assertJsonPath('tools', ['list_documents']);

        // The second request carried the function result back to Gemini.
        Http::assertSent(function ($r) {
            $parts = $r['contents'][2]['parts'][0] ?? [];

            return ($parts['functionResponse']['name'] ?? null) === 'list_documents'
                && $parts['functionResponse']['response']['result']['count'] === 1;
        });
    }

    #[Test]
    public function chat_validates_messages_and_reports_gemini_errors(): void
    {
        $this->postJson('/api/ai/chat', ['messages' => []])->assertUnprocessable();

        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'quota']], 429)]);
        $this->postJson('/api/ai/chat', ['messages' => [['role' => 'user', 'text' => 'hi']]])->assertStatus(429);
    }
}
