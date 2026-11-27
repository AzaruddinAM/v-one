<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentItem;
use App\Models\Item;
use App\Models\StockMovement;
use App\Services\StockService;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ItemController extends Controller
{
    private function rules(?Item $item = null): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'sku' => ['nullable', 'string', 'max:60', Tenant::unique('items', 'sku', $item?->id)],
            'type' => ['required', Rule::in(['goods', 'service'])],
            'unit' => ['nullable', 'string', 'max:20'],
            'hsn_code' => ['nullable', 'string', 'max:20'],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sales_price' => ['required', 'numeric', 'min:0'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'tax_id' => ['nullable', Tenant::exists('taxes')],
            'track_inventory' => ['boolean'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'opening_stock' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ];
    }

    public function index(Request $request)
    {
        $q = Item::query()->with('tax:id,name,rate')
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->category, fn ($q, $c) => $q->where('category', $c))
            ->when($request->has('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->when($request->boolean('low_stock'), fn ($q) => $q->where('track_inventory', true)->whereColumn('stock_on_hand', '<=', 'reorder_level'));
        $this->search($q, $request->q, ['name', 'sku', 'hsn_code', 'category']);
        $this->columnFilters($q, $request, [
            'name' => static::whereAny(['name', 'sku', 'hsn_code']),
            'type' => ['type', 'eq'],
            'category' => ['category', 'like'],
            'tax' => static::whereRelated('tax', 'name'),
            'price_min' => ['sales_price', 'min'],
            'price_max' => ['sales_price', 'max'],
            'purchase_min' => ['purchase_price', 'min'],
            'purchase_max' => ['purchase_price', 'max'],
            'stock_min' => ['stock_on_hand', 'min'],
            'stock_max' => ['stock_on_hand', 'max'],
        ]);
        $this->sort($q, $request, ['name', 'type', 'category', 'sales_price', 'purchase_price', 'stock_on_hand', 'created_at', 'id'], 'name', [
            'tax' => static::orderByRelated('taxes', 'tax_id', 'name'),
        ]);

        return $this->paginate($q, $request);
    }

    public function store(Request $request, StockService $stock)
    {
        $data = $request->validate($this->rules());
        $opening = (float) ($data['opening_stock'] ?? 0);
        unset($data['opening_stock']);
        if (($data['type'] ?? 'goods') === 'service') {
            $data['track_inventory'] = false;
        }
        $item = Item::create($data);
        if ($item->track_inventory && $opening > 0) {
            $stock->adjust($item, $opening, today()->toDateString(), 'Opening stock');
        }

        return response()->json($item->fresh('tax'), 201);
    }

    public function show(Item $item)
    {
        return $item->load('tax');
    }

    public function update(Request $request, Item $item)
    {
        $data = $request->validate($this->rules($item));
        unset($data['opening_stock']);
        if (($data['type'] ?? $item->type) === 'service') {
            $data['track_inventory'] = false;
        }
        $item->update($data);

        return $item->fresh('tax');
    }

    public function destroy(Item $item)
    {
        abort_if(DocumentItem::where('item_id', $item->id)->exists(), 422, 'This item is used in transactions. Mark it inactive instead.');
        $item->delete();

        return response()->noContent();
    }

    public function categories()
    {
        return Item::whereNotNull('category')->distinct()->orderBy('category')->pluck('category');
    }

    public function adjustStock(Request $request, Item $item, StockService $stock)
    {
        abort_unless($item->track_inventory, 422, 'Inventory tracking is disabled for this item.');
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'not_in:0'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);
        $stock->adjust($item, (float) $data['quantity'], $data['date'], $data['notes'] ?? null);

        return $item->fresh('tax');
    }

    public function movements(Request $request, Item $item)
    {
        return $this->paginate(
            StockMovement::where('item_id', $item->id)->with('document:id,type,number')->latest('date')->latest('id'),
            $request
        );
    }
}
