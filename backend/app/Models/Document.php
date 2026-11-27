<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use App\Models\Concerns\RespectsLockDate;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    use BelongsToOrganization, HasFactory, RespectsLockDate;

    /** Payment-driven / housekeeping columns that may change inside a locked period. */
    protected array $lockIgnored = ['status', 'amount_paid', 'balance', 'reminded_at', 'reminder_count'];

    public const TYPES = ['estimate', 'sales_order', 'delivery_challan', 'retainer_invoice', 'invoice', 'credit_note', 'purchase_order', 'bill', 'vendor_credit'];

    public const SALES = ['estimate', 'sales_order', 'delivery_challan', 'retainer_invoice', 'invoice', 'credit_note'];

    public const PREFIX = [
        'estimate' => 'EST-', 'sales_order' => 'SO-', 'delivery_challan' => 'DC-', 'retainer_invoice' => 'RET-', 'invoice' => 'INV-',
        'credit_note' => 'CN-', 'purchase_order' => 'PO-', 'bill' => 'BILL-', 'vendor_credit' => 'VC-',
    ];

    /** Zoho-style payment terms: label => days after the document date (null = end of month rules). */
    public const PAYMENT_TERMS = [
        'Due on receipt' => 0, 'Net 7' => 7, 'Net 15' => 15, 'Net 30' => 30, 'Net 45' => 45, 'Net 60' => 60, 'Net 90' => 90,
        'Due end of the month' => null, 'Due end of next month' => null,
    ];

    /** Statuses a user may set manually per document type. */
    public const MANUAL_STATUSES = [
        'estimate' => ['draft', 'sent', 'accepted', 'declined'],
        'sales_order' => ['draft', 'open', 'closed', 'void'],
        'delivery_challan' => ['draft', 'open', 'delivered', 'returned', 'void'],
        'retainer_invoice' => ['draft', 'sent', 'void'],
        'invoice' => ['draft', 'sent', 'void'],
        'credit_note' => ['draft', 'open', 'void'],
        'purchase_order' => ['draft', 'open', 'closed', 'void'],
        'bill' => ['draft', 'open', 'void'],
        'vendor_credit' => ['draft', 'open', 'closed', 'void'],
    ];

    protected $fillable = [
        'type', 'number', 'reference', 'contact_id', 'date', 'due_date', 'payment_terms', 'status', 'subtotal',
        'discount', 'tax_total', 'adjustment', 'total', 'amount_paid', 'balance', 'notes', 'terms',
        'converted_from_id', 'recurring_profile_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d', 'due_date' => 'date:Y-m-d',
            'subtotal' => 'float', 'discount' => 'float', 'tax_total' => 'float', 'adjustment' => 'float',
            'total' => 'float', 'amount_paid' => 'float', 'balance' => 'float', 'contact_id' => 'integer',
            'reminded_at' => 'datetime', 'reminder_count' => 'integer',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(DocumentItem::class)->orderBy('sort');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function recurringProfile(): BelongsTo
    {
        return $this->belongsTo(RecurringProfile::class);
    }

    /** Due date for a payment-terms label, or null when the label is unknown / custom. */
    public static function dueDateFor(?string $terms, string $date): ?string
    {
        if (! $terms || ! array_key_exists($terms, self::PAYMENT_TERMS)) {
            return null;
        }
        $d = \Illuminate\Support\Carbon::parse($date);

        return match ($terms) {
            'Due end of the month' => $d->endOfMonth()->toDateString(),
            'Due end of next month' => $d->startOfMonth()->addMonthNoOverflow()->endOfMonth()->toDateString(),
            default => $d->addDays(self::PAYMENT_TERMS[$terms])->toDateString(),
        };
    }

    public function convertedFrom(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'converted_from_id');
    }

    public function isPayable(): bool
    {
        return in_array($this->type, ['invoice', 'bill', 'retainer_invoice'], true);
    }

    public function isSales(): bool
    {
        return in_array($this->type, self::SALES, true);
    }

    /** Stock direction for inventory tracked items: -1 sold, +1 received, 0 none. */
    public function stockDirection(): int
    {
        if (in_array($this->status, ['draft', 'void'], true)) {
            return 0;
        }

        return match ($this->type) {
            'invoice' => -1,
            'bill', 'credit_note' => 1,
            'vendor_credit' => -1, // goods returned to the vendor
            default => 0,
        };
    }
}
