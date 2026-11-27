<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class OrganizationController extends Controller
{
    public function show(Request $request)
    {
        return $request->user()->organization;
    }

    public function update(Request $request)
    {
        $org = $request->user()->organization;
        $rules = [
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'industry' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'string', 'max:20'],
            'gstin' => ['nullable', 'string', 'max:30'],
            'currency' => ['required', 'string', 'max:10'],
            'currency_symbol' => ['required', 'string', 'max:5'],
            'fiscal_year_start' => ['required', 'integer', 'between:1,12'],
            'date_format' => ['nullable', 'string', 'max:20'],
            'invoice_terms' => ['nullable', 'string', 'max:2000'],
            'invoice_notes' => ['nullable', 'string', 'max:2000'],
        ];

        // PDF layout settings. Skipped when the database has not been upgraded yet
        // (deploy/sql/upgrade-2026-11-pdf-templates.sql), so saving never breaks.
        if (Schema::hasColumn('organizations', 'pdf_template')) {
            $rules += [
                'pdf_template' => ['sometimes', 'string', Rule::in(Organization::PDF_TEMPLATES)],
                'pdf_accent' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
                'pdf_footer' => ['nullable', 'string', 'max:1000'],
            ];
        }

        if (Schema::hasColumn('organizations', 'pdf_options')) {
            $rules['pdf_options'] = ['sometimes', 'nullable', 'array'];
            foreach (Organization::pdfOptionRules() as $key => $keyRules) {
                $rules["pdf_options.$key"] = $keyRules;
            }
        }

        $data = $request->validate($rules);
        if (isset($data['pdf_options'])) {
            // Keep only known keys, with booleans stored as real booleans.
            $options = Arr::only($data['pdf_options'], array_keys(Organization::pdfOptionRules()));
            foreach ($options as $key => $value) {
                if (str_starts_with($key, 'show_')) {
                    $options[$key] = (bool) $value;
                }
            }
            $data['pdf_options'] = $options;
        }

        $org->update($data);

        return $org->fresh();
    }
}
