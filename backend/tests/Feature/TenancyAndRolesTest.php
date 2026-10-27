<?php

namespace Tests\Feature;

use App\Models\Contact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TenancyAndRolesTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function organizations_cannot_see_each_others_data(): void
    {
        $this->signIn();
        $mine = $this->customer(['name' => 'Mine']);

        $other = $this->createOrgUser();
        $theirs = Contact::factory()->create(['organization_id' => $other->organization_id, 'name' => 'Theirs']);

        $this->getJson('/api/contacts?type=customer')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Mine');
        $this->getJson("/api/contacts/{$theirs->id}")->assertNotFound();
        $this->putJson("/api/contacts/{$theirs->id}", ['type' => 'customer', 'name' => 'Hacked'])->assertNotFound();
        $this->assertSame('Theirs', $theirs->fresh()->name);
        $this->getJson("/api/contacts/{$mine->id}")->assertOk();
    }

    #[Test]
    public function documents_cannot_reference_another_organizations_contact(): void
    {
        $this->signIn();
        $item = $this->goods();
        $other = $this->createOrgUser();
        $foreign = Contact::factory()->create(['organization_id' => $other->organization_id]);

        $this->postJson('/api/documents', $this->invoicePayload($foreign, $item))
            ->assertUnprocessable()->assertJsonValidationErrors('contact_id');
    }

    #[Test]
    public function staff_cannot_delete_or_manage_users(): void
    {
        $this->signIn('staff');
        $c = $this->customer();

        $this->deleteJson("/api/contacts/{$c->id}")->assertForbidden();
        $this->getJson('/api/users')->assertForbidden();
        $this->putJson('/api/organization', ['name' => 'X', 'currency' => 'INR', 'currency_symbol' => '₹', 'fiscal_year_start' => 4])->assertForbidden();
        $this->postJson('/api/contacts', ['type' => 'customer', 'name' => 'Allowed'])->assertCreated();
    }

    #[Test]
    public function admin_can_create_team_members_who_can_then_login(): void
    {
        $admin = $this->signIn();

        $this->postJson('/api/users', [
            'name' => 'Accountant', 'phone' => '9000000001', 'role' => 'accountant', 'password' => 'Account123',
        ])->assertCreated();

        $this->postJson('/api/auth/login', ['phone' => '9000000001', 'password' => 'Account123'])
            ->assertOk()->assertJsonPath('user.organization_id', $admin->organization_id);
    }

    #[Test]
    public function deactivated_user_tokens_are_rejected(): void
    {
        $user = $this->createOrgUser();
        $user->update(['is_active' => false]);
        Sanctum::actingAs($user);

        $this->getJson('/api/contacts?type=customer')->assertUnauthorized();
    }
}
