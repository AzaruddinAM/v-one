<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Tax;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_business_can_register_with_phone_and_password(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'name' => 'Azar', 'organization_name' => 'Acme Pvt Ltd', 'phone' => '+91 98765 00001',
            'password' => 'Secret123', 'password_confirmation' => 'Secret123',
        ]);

        $res->assertCreated()->assertJsonStructure(['token', 'user' => ['id', 'phone', 'organization' => ['name']]]);
        $user = User::first();
        $this->assertSame('+919876500001', $user->phone);
        $this->assertSame('admin', $user->role);
        $this->assertGreaterThan(10, Account::withoutGlobalScopes()->where('organization_id', $user->organization_id)->count());
        $this->assertSame(5, Tax::withoutGlobalScopes()->where('organization_id', $user->organization_id)->count());
    }

    #[Test]
    public function registration_rejects_duplicate_phone_and_weak_password(): void
    {
        $this->createOrgUser()->update(['phone' => '9876500002']);

        $this->postJson('/api/auth/register', [
            'name' => 'X', 'organization_name' => 'Y', 'phone' => '98765 00002',
            'password' => 'short', 'password_confirmation' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors(['phone', 'password']);
    }

    #[Test]
    public function a_user_can_login_with_phone_in_any_format(): void
    {
        $this->createOrgUser()->update(['phone' => '9876500003']);

        $this->postJson('/api/auth/login', ['phone' => '98765-00003', 'password' => 'Secret123'])
            ->assertOk()->assertJsonStructure(['token', 'user']);
    }

    #[Test]
    public function login_fails_with_wrong_password(): void
    {
        $this->createOrgUser()->update(['phone' => '9876500004']);

        $this->postJson('/api/auth/login', ['phone' => '9876500004', 'password' => 'Wrong1234'])
            ->assertUnprocessable()->assertJsonValidationErrors('phone');
    }

    #[Test]
    public function inactive_users_cannot_login(): void
    {
        $this->createOrgUser()->update(['phone' => '9876500005', 'is_active' => false]);

        $this->postJson('/api/auth/login', ['phone' => '9876500005', 'password' => 'Secret123'])
            ->assertUnprocessable();
    }

    #[Test]
    public function login_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['phone' => '9876500006', 'password' => 'Wrong1234']);
        }
        $this->postJson('/api/auth/login', ['phone' => '9876500006', 'password' => 'Wrong1234'])->assertStatus(429);
    }

    #[Test]
    public function protected_routes_require_a_token_and_logout_revokes_it(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();

        $this->createOrgUser()->update(['phone' => '9876500007']);
        $token = $this->postJson('/api/auth/login', ['phone' => '9876500007', 'password' => 'Secret123'])->json('token');

        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('phone', '9876500007');
        $this->withToken($token)->postJson('/api/auth/logout')->assertNoContent();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[Test]
    public function a_user_can_change_password(): void
    {
        $this->signIn();

        $this->putJson('/api/auth/password', [
            'current_password' => 'Secret123', 'password' => 'NewSecret99', 'password_confirmation' => 'NewSecret99',
        ])->assertOk();

        $this->putJson('/api/auth/password', [
            'current_password' => 'nope', 'password' => 'NewSecret99', 'password_confirmation' => 'NewSecret99',
        ])->assertUnprocessable();
    }
}
