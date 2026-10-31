<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentItem;
use App\Models\Tax;
use Illuminate\Http\Request;

class TaxController extends Controller
{
    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'rate' => ['required', 'numeric', 'between:0,100'],
            'type' => ['nullable', 'string', 'max:20'],
            'is_active' => ['boolean'],
        ];
    }

    public function index()
    {
        return Tax::orderBy('rate')->get();
    }

    public function store(Request $request)
    {
        return response()->json(Tax::create($request->validate($this->rules())), 201);
    }

    public function show(Tax $tax)
    {
        return $tax;
    }

    public function update(Request $request, Tax $tax)
    {
        $tax->update($request->validate($this->rules()));

        return $tax;
    }

    public function destroy(Tax $tax)
    {
        abort_if(DocumentItem::where('tax_id', $tax->id)->exists(), 422, 'This tax is used in transactions. Mark it inactive instead.');
        $tax->delete();

        return response()->noContent();
    }
}
