<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ListFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn();
    }

    private function invoice($contact, float $rate, string $date): void
    {
        $this->postJson('/api/documents', [
            'type' => 'invoice', 'contact_id' => $contact->id, 'date' => $date, 'status' => 'sent',
            'items' => [['name' => 'Light', 'quantity' => 1, 'rate' => $rate]],
        ])->assertCreated();
    }

    #[Test]
    public function documents_filter_by_column_and_sort_by_customer_name(): void
    {
        $a = $this->customer(['name' => 'Alpha Traders']);
        $z = $this->customer(['name' => 'Zeta Stores']);
        $this->invoice($z, 500, '2026-11-01');
        $this->invoice($a, 100, '2026-11-10');
        $this->invoice($a, 900, '2026-11-20');

        $this->getJson('/api/documents?type=invoice&f_contact=alpha')->assertJsonPath('total', 2);
        $this->getJson('/api/documents?type=invoice&f_total_min=400&f_total_max=600')->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.contact.name', 'Zeta Stores');
        $this->getJson('/api/documents?type=invoice&f_date_from=2026-11-05&f_date_to=2026-11-15')->assertJsonPath('total', 1);
        // Junk in a number box is ignored, not an error.
        $this->getJson('/api/documents?type=invoice&f_total_min=abc')->assertOk()->assertJsonPath('total', 3);

        $names = collect($this->getJson('/api/documents?type=invoice&sort=-contact')->json('data'))->pluck('contact.name')->all();
        $this->assertSame(['Zeta Stores', 'Alpha Traders', 'Alpha Traders'], $names);
        $totals = collect($this->getJson('/api/documents?type=invoice&sort=total')->json('data'))->pluck('total')->all();
        $this->assertEquals([100, 500, 900], $totals);
    }

    #[Test]
    public function items_and_contacts_filter_and_sort(): void
    {
        $this->goods(['name' => '100% Cotton', 'sales_price' => 50]);
        $this->goods(['name' => 'LED strip', 'sales_price' => 20]);
        $this->getJson('/api/items?f_name=cott')->assertJsonPath('total', 1);
        $this->getJson('/api/items?f_price_max=30')->assertJsonPath('total', 1)->assertJsonPath('data.0.name', 'LED strip');
        $this->getJson('/api/items?sort=-sales_price')->assertJsonPath('data.0.name', '100% Cotton');

        $this->customer(['name' => 'Dubai Lights', 'city' => 'Dubai']);
        $this->customer(['name' => 'Sharjah Co', 'city' => 'Sharjah']);
        $this->getJson('/api/contacts?type=customer&f_city=shar')->assertJsonPath('total', 1);
        $this->getJson('/api/contacts?type=customer&sort=-outstanding')->assertOk();
    }

    #[Test]
    public function preferences_are_merged_and_unknown_keys_dropped(): void
    {
        $this->putJson('/api/organization/preferences', ['table_filters' => false])->assertOk()
            ->assertJsonPath('preferences.table_filters', false);
        $this->putJson('/api/organization/preferences', ['unknown' => 1])->assertOk()
            ->assertJsonPath('preferences.table_filters', false)->assertJsonMissingPath('preferences.unknown');
    }
}
