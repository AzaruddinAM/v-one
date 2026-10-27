<?php

namespace Tests;

use App\Models\Contact;
use App\Models\Item;
use App\Models\Organization;
use App\Models\Tax;
use App\Models\User;
use App\Services\OrganizationSetup;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    protected function createOrgUser(string $role = 'admin'): User
    {
        $org = Organization::factory()->create();
        app(OrganizationSetup::class)->run($org);

        return User::factory()->role($role)->create(['organization_id' => $org->id]);
    }

    protected function signIn(string $role = 'admin'): User
    {
        $user = $this->createOrgUser($role);
        Sanctum::actingAs($user);
        $this->app['auth']->setUser($user);

        return $user;
    }

    protected function customer(array $attrs = []): Contact
    {
        return Contact::factory()->create($attrs + ['organization_id' => auth()->user()->organization_id]);
    }

    protected function vendor(array $attrs = []): Contact
    {
        return Contact::factory()->vendor()->create($attrs + ['organization_id' => auth()->user()->organization_id]);
    }

    protected function goods(array $attrs = []): Item
    {
        return Item::factory()->create($attrs + ['organization_id' => auth()->user()->organization_id]);
    }

    protected function tax(float $rate): Tax
    {
        return Tax::where('rate', $rate)->firstOrFail();
    }

    protected function invoicePayload(Contact $c, Item $item, array $overrides = []): array
    {
        return array_merge([
            'type' => 'invoice',
            'contact_id' => $c->id,
            'date' => today()->toDateString(),
            'due_date' => today()->addDays(15)->toDateString(),
            'status' => 'sent',
            'items' => [[
                'item_id' => $item->id, 'name' => $item->name, 'quantity' => 2,
                'rate' => 100, 'tax_id' => $this->tax(18)->id,
            ]],
        ], $overrides);
    }
}
