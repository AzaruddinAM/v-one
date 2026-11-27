<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class VoiceLinesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
        $this->goods(['name' => 'LED strip', 'sales_price' => 45, 'purchase_price' => 30, 'unit' => 'm']);
    }

    #[Test]
    public function without_ai_simple_english_is_understood_and_matched_to_items(): void
    {
        config(['services.gemini.key' => '']);
        $r = $this->postJson('/api/ai/parse-lines', ['text' => '2 LED strips at 50 and three drivers, ١٢ clips', 'type' => 'invoice'])
            ->assertOk()->assertJsonPath('ai', false)->json('lines');

        $this->assertSame('LED strip', $r[0]['name']);
        $this->assertTrue($r[0]['matched']);
        $this->assertEquals([2, 50.0, 'm'], [$r[0]['quantity'], $r[0]['rate'], $r[0]['unit']]);
        $this->assertEquals(['drivers', 3, false], [$r[1]['name'], $r[1]['quantity'], $r[1]['matched']]);
        $this->assertEquals(['clips', 12], [$r[2]['name'], $r[2]['quantity']]);

        // On a bill an item said without a price gets the purchase price.
        $bill = $this->postJson('/api/ai/parse-lines', ['text' => '5 led strip', 'type' => 'bill'])->json('lines.0');
        $this->assertEquals(30, $bill['rate']);
    }

    #[Test]
    public function with_ai_malayalam_speech_becomes_lines_and_a_customer(): void
    {
        config(['services.gemini.key' => 'test-key']);
        $this->customer(['name' => 'Ravi Stores']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['role' => 'model', 'parts' => [[
            'text' => json_encode(['contact_name' => 'Ravi Stores', 'lines' => [['name' => 'LED strip', 'quantity' => 2, 'rate' => 50], ['name' => 'Ceiling fan', 'quantity' => 1]]]),
        ]]]]]])]);

        $this->postJson('/api/ai/parse-lines', ['text' => 'റാവി സ്റ്റോഴ്സിന് രണ്ട് എൽഇഡി സ്ട്രിപ്പ് അമ്പത് രൂപ, ഒരു ഫാൻ', 'type' => 'invoice'])
            ->assertOk()
            ->assertJsonPath('ai', true)
            ->assertJsonPath('contact.name', 'Ravi Stores')
            ->assertJsonPath('lines.0.matched', true)
            ->assertJsonPath('lines.1.name', 'Ceiling fan')
            ->assertJsonPath('lines.1.rate', 0);

        Http::assertSent(fn ($req) => str_contains(json_encode($req->data()), 'LED strip'));
    }
}
