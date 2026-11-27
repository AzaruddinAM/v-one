<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BarcodeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
    }

    #[Test]
    public function scanned_code_finds_the_item_by_barcode_then_sku(): void
    {
        $this->postJson('/api/items', ['name' => 'LED strip', 'type' => 'goods', 'sales_price' => 50, 'barcode' => '8901234567890', 'sku' => 'LED-1'])->assertCreated();
        $this->postJson('/api/items', ['name' => 'Copy', 'type' => 'goods', 'sales_price' => 1, 'barcode' => '8901234567890'])
            ->assertUnprocessable()->assertJsonValidationErrors('barcode');

        $this->getJson('/api/items/lookup?code=8901234567890')->assertOk()->assertJsonPath('name', 'LED strip');
        $this->getJson('/api/items/lookup?code=LED-1')->assertOk()->assertJsonPath('name', 'LED strip');
        $this->getJson('/api/items/lookup?code=nothing')->assertNotFound();
        $this->getJson('/api/items?q=890123')->assertJsonPath('total', 1);
    }

    #[Test]
    public function codes_are_per_organization(): void
    {
        $this->postJson('/api/items', ['name' => 'Mine', 'type' => 'goods', 'sales_price' => 5, 'barcode' => 'ABC123'])->assertCreated();
        $this->signIn();
        $this->getJson('/api/items/lookup?code=ABC123')->assertNotFound();
        $this->postJson('/api/items', ['name' => 'Theirs', 'type' => 'goods', 'sales_price' => 5, 'barcode' => 'ABC123'])->assertCreated();
    }
}
