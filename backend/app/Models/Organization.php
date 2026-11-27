<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasFactory;

    /** Layouts available for printed / PDF documents (rendered by the frontend). */
    public const PDF_TEMPLATES = ['classic', 'modern', 'minimal', 'gst'];

    protected $fillable = [
        'name', 'phone', 'email', 'industry', 'address', 'city', 'state', 'country', 'pincode',
        'gstin', 'currency', 'currency_symbol', 'fiscal_year_start', 'date_format',
        'invoice_terms', 'invoice_notes', 'pdf_template', 'pdf_accent', 'pdf_footer',
    ];

    protected function casts(): array
    {
        return ['fiscal_year_start' => 'integer'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
