<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Document;
use App\Models\Payment;
use App\Models\Tax;

/** Small, cacheable reference data the UI needs on most screens (one round-trip). */
class LookupController extends Controller
{
    public function __invoke()
    {
        return [
            'taxes' => Tax::where('is_active', true)->orderBy('rate')->get(['id', 'name', 'rate']),
            'accounts' => Account::where('is_active', true)->orderBy('code')->get(['id', 'code', 'name', 'type', 'sub_type']),
            'payment_modes' => Payment::MODES,
            'units' => ['pcs', 'nos', 'box', 'kg', 'g', 'ltr', 'ml', 'm', 'cm', 'ft', 'dozen', 'pack', 'hrs', 'days'],
            'statuses' => Document::MANUAL_STATUSES,
        ];
    }
}
