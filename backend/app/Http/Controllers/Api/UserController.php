<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    private function scoped()
    {
        return User::where('organization_id', auth()->user()->organization_id);
    }

    public function index(Request $request)
    {
        return $this->scoped()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $request->merge(['phone' => User::normalizePhone($request->input('phone'))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'regex:/^\+?[0-9]{10,15}$/', 'unique:users,phone'],
            'email' => ['nullable', 'email'],
            'role' => ['required', Rule::in(User::ROLES)],
            'password' => ['required', Password::min(8)->letters()->numbers()],
        ]);

        return response()->json(User::create($data + ['organization_id' => auth()->user()->organization_id]), 201);
    }

    public function update(Request $request, int $id)
    {
        $user = $this->scoped()->findOrFail($id);
        $request->merge(['phone' => User::normalizePhone($request->input('phone', $user->phone))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'regex:/^\+?[0-9]{10,15}$/', Rule::unique('users', 'phone')->ignore($user->id)],
            'email' => ['nullable', 'email'],
            'role' => ['required', Rule::in(User::ROLES)],
            'is_active' => ['boolean'],
            'password' => ['nullable', Password::min(8)->letters()->numbers()],
        ]);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        if ($user->id === auth()->id()) {
            unset($data['role'], $data['is_active']); // can't demote/deactivate yourself
        }
        $user->update($data);

        return $user;
    }

    public function destroy(int $id)
    {
        $user = $this->scoped()->findOrFail($id);
        abort_if($user->id === auth()->id(), 422, 'You cannot delete your own account.');
        $user->tokens()->delete();
        $user->delete();

        return response()->noContent();
    }
}
