<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One "Send by email" of a document: who it went to and when. */
class DocumentEmail extends Model
{
    use BelongsToOrganization;

    public const UPDATED_AT = null;

    protected $fillable = ['document_id', 'to', 'cc', 'subject', 'with_pdf', 'sent_by'];

    protected function casts(): array
    {
        return ['with_pdf' => 'boolean', 'created_at' => 'datetime'];
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
