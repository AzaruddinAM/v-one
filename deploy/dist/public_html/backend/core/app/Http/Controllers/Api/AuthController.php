<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use App\Services\OrganizationSetup;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private function phoneRules(): array
    {
        return ['required', 'string', 'regex:/^\+?[0-9]{10,15}$/'];
    }

    private function tokenResponse(User $user, int $status = 200)
    {
        $token = $user->createToken('v-one-web', ['*'], now()->addDays(30))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->load('organization'),
        ], $status);
    }

    public function register(Request $request, OrganizationSetup $setup)
    {
        $request->merge(['phone' => User::normalizePhone($request->input('phone'))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'organization_name' => ['required', 'string', 'max:150'],
            'phone' => [...$this->phoneRules(), 'unique:users,phone'],
            'email' => ['nullable', 'email', 'max:150'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = DB::transaction(function () use ($data, $setup) {
            $org = Organization::create(['name' => $data['organization_name'], 'phone' => $data['phone'], 'email' => $data['email'] ?? null]);
            $setup->run($org);

            return User::create([
                'organization_id' => $org->id, 'name' => $data['name'], 'phone' => $data['phone'],
                'email' => $data['email'] ?? null, 'password' => $data['password'], 'role' => 'admin',
                'last_login_at' => now(),
            ]);
        });

        return $this->tokenResponse($user, 201);
    }

    public function login(Request $request)
    {
        $request->merge(['phone' => User::normalizePhone($request->input('phone'))]);
        $data = $request->validate([
            'phone' => $this->phoneRules(),
            'password' => ['required', 'string'],
        ]);

        $user = User::where('phone', $data['phone'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['phone' => 'Invalid phone number or password.']);
        }
        if (! $user->is_active) {
            throw ValidationException::withMessages(['phone' => 'Your account has been deactivated. Contact your administrator.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return $this->tokenResponse($user);
    }

    public function me(Request $request)
    {
        return $request->user()->load('organization');
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:150'],
        ]);
        $user->update($data);

        return $user->load('organization');
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);
        $request->user()->update(['password' => $data['password']]);

        return response()->json(['message' => 'Password updated.']);
    }
}
