<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    use BelongsToOrganization, HasFactory;

    public const TYPES = ['estimate', 'sales_order', 'invoice', 'credit_note', 'purchase_order', 'bill'];

    public const SALES = ['estimate', 'sales_order', 'invoice', 'credit_note'];

    public const PREFIX = [
        'estimate' => 'EST-', 'sales_order' => 'SO-', 'invoice' => 'INV-',
        'credit_note' => 'CN-', 'purchase_order' => 'PO-', 'bill' => 'BILL-',
    ];

    /** Statuses a user may set manually per document type. */
    public const MANUAL_STATUSES = [
        'estimate' => ['draft', 'sent', 'accepted', 'declined'],
        'sales_order' => ['draft', 'open', 'closed', 'void'],
        'invoice' => ['draft', 'sent', 'void'],
        'credit_note' => ['draft', 'open', 'void'],
        'purchase_order' => ['draft', 'open', 'closed', 'void'],
        'bill' => ['draft', 'open', 'void'],
    ];

    protected $fillable = [
        'type', 'number', 'reference', 'contact_id', 'date', 'due_date', 'status', 'subtotal',
        'discount', 'tax_total', 'adjustment', 'total', 'amount_paid', 'balance', 'notes', 'terms',
        'converted_from_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d', 'due_date' => 'date:Y-m-d',
            'subtotal' => 'float', 'discount' => 'float', 'tax_total' => 'float', 'adjustment' => 'float',
            'total' => 'float', 'amount_paid' => 'float', 'balance' => 'float', 'contact_id' => 'integer',
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

    public function convertedFrom(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'converted_from_id');
    }

    public function isPayable(): bool
    {
        return in_array($this->type, ['invoice', 'bill'], true);
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
            default => 0,
        };
    }
}
