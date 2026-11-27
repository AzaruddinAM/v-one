<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;

class ReconciledEntry extends Model
{
    use BelongsToOrganization;

    public $timestamps = false;

    protected $fillable = ['account_id', 'reconciliation_id', 'entry_key'];
}
