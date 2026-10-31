<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    use BelongsToOrganization, HasFactory;

    public const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

    protected $fillable = ['code', 'name', 'type', 'sub_type', 'description', 'opening_balance', 'is_system', 'is_active'];

    protected function casts(): array
    {
        return ['opening_balance' => 'float', 'is_system' => 'boolean', 'is_active' => 'boolean'];
    }
}
