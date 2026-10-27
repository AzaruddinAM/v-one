<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Journal extends Model
{
    use BelongsToOrganization;

    protected $fillable = ['number', 'date', 'reference', 'notes', 'total'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'total' => 'float'];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalLine::class);
    }
}
