<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasFactory;

    /** Layouts available for printed / PDF documents (rendered by the frontend). */
    public const PDF_TEMPLATES = ['classic', 'modern', 'minimal', 'gst', 'standard', 'elegant', 'bold', 'corporate', 'creative', 'wave', 'geometric', 'gradient', 'splash', 'bilingual'];

    /** Images are stored as data URLs (resized in the browser), so keep them small. */
    public const PDF_IMAGE_MAX = 500_000;

    /** Validation rules for each key of pdf_options; anything else is dropped. */
    public static function pdfOptionRules(): array
    {
        $image = ['nullable', 'string', 'max:'.self::PDF_IMAGE_MAX, 'regex:/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/'];
        $text = fn (int $max) => ['nullable', 'string', 'max:'.$max];
        $rules = [
            'logo' => $image,
            'signature' => $image,
            'logo_position' => ['sometimes', 'in:left,right,center'],
            'logo_size' => ['sometimes', 'in:s,m,l'],
            'header_text' => $text(200),
            'title_invoice' => $text(40),
            'title_estimate' => $text(40),
            'signatory_label' => $text(60),
            'footer_note' => $text(200),
            'font' => ['sometimes', 'in:sans,serif,mono'],
            'font_size' => ['sometimes', 'in:compact,normal,large'],
            'paper' => ['sometimes', 'in:A4,Letter,A5'],
        ];
        foreach (['show_org_name', 'show_org_address', 'show_org_gstin', 'show_org_phone', 'show_org_email', 'show_customer_gstin',
            'show_item_description', 'show_discount_column', 'show_tax_column', 'show_amount_words', 'show_notes', 'show_terms',
            'show_balance', 'show_paid_stamp', 'show_signature'] as $flag) {
            $rules[$flag] = ['sometimes', 'boolean'];
        }

        return $rules;
    }

    protected $fillable = [
        'name', 'phone', 'email', 'industry', 'address', 'city', 'state', 'country', 'pincode',
        'gstin', 'tax_regime', 'currency', 'currency_symbol', 'fiscal_year_start', 'date_format',
        'invoice_terms', 'invoice_notes', 'pdf_template', 'pdf_accent', 'pdf_footer', 'pdf_options',
        'number_series', 'reminder_template', 'lock_date', 'preferences',
    ];

    /** Validation rules for each key of preferences (feature switches); anything else is dropped. */
    public static function preferenceRules(): array
    {
        return [
            'table_filters' => ['sometimes', 'boolean'],
            // Product photos on document lines and in the printed PDF.
            'line_images' => ['sometimes', 'boolean'],
            'line_image_docs' => ['sometimes', 'array'],
            'line_image_docs.*' => [\Illuminate\Validation\Rule::in(Document::TYPES)],
            'line_image_size' => ['sometimes', 'in:s,m,l'],
            'line_image_layout' => ['sometimes', 'in:column,below,gallery'],
        ];
    }

    /** Line / item photos are data URLs resized in the browser; keep each one small. */
    public const LINE_IMAGE_MAX = 350_000;

    public static function lineImageRule(): array
    {
        return ['nullable', 'string', 'max:'.self::LINE_IMAGE_MAX, 'regex:/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/'];
    }

    /** gst = India GST (GSTIN, CGST/SGST), vat = UAE VAT (TRN, VAT return), none = plain sales tax. */
    public const TAX_REGIMES = ['gst', 'vat', 'none'];

    protected function casts(): array
    {
        return [
            'fiscal_year_start' => 'integer', 'pdf_options' => 'array', 'number_series' => 'array', 'preferences' => 'array',
            'lock_date' => 'date:Y-m-d',
            // SMTP details incl. password: encrypted with APP_KEY, never serialized (see OrgMailer::publicSettings).
            'mail_settings' => 'encrypted:array',
        ];
    }

    protected $hidden = ['mail_settings'];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
