<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tax extends Model
{
    use BelongsToOrganization, HasFactory;

    protected $fillable = ['name', 'rate', 'type', 'is_active'];

    protected function casts(): array
    {
        return ['rate' => 'float', 'is_active' => 'boolean'];
    }
}
