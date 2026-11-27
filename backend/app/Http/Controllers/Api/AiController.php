<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AssistantService;
use App\Services\Ai\BillImporter;
use App\Services\Ai\BillScanner;
use App\Models\Document;
use App\Services\Ai\GeminiClient;
use App\Services\Ai\VoiceLineParser;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AiController extends Controller
{
    public function status(GeminiClient $gemini)
    {
        return ['enabled' => $gemini->configured(), 'model' => $gemini->model()];
    }

    /** Step 1: read the uploaded bill with Gemini and return an editable preview (nothing is saved). */
    public function scanBill(Request $request, BillScanner $scanner)
    {
        $this->allowTimeForGemini();
        $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'],
        ], ['file.mimetypes' => 'Upload a photo (JPG, PNG, WEBP, HEIC) or a PDF.']);

        return $scanner->scan($request->file('file'));
    }

    /** Step 2: the user confirmed the (possibly edited) preview — save it. */
    public function importBill(Request $request, BillImporter $importer)
    {
        $isBill = $request->input('target') === 'bill';
        $data = $request->validate([
            'target' => ['required', Rule::in(['bill', 'expense'])],
            'reference' => ['nullable', 'string', 'max:60'],
            'date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:date'],
            'status' => ['nullable', Rule::in(['draft', 'open'])],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'adjustment' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string', 'max:2000'],

            'vendor' => [$isBill ? 'required' : 'nullable', 'array'],
            'vendor.id' => ['nullable', Tenant::exists('contacts')->where('type', 'vendor')],
            'vendor.name' => [$isBill ? 'required_without:vendor.id' : 'nullable', 'nullable', 'string', 'max:150'],
            'vendor.gstin' => ['nullable', 'string', 'max:30'],
            'vendor.pan' => ['nullable', 'string', 'max:20'],
            'vendor.phone' => ['nullable', 'string', 'max:20'],
            'vendor.email' => ['nullable', 'email', 'max:150'],
            'vendor.billing_address' => ['nullable', 'string', 'max:500'],
            'vendor.city' => ['nullable', 'string', 'max:100'],
            'vendor.state' => ['nullable', 'string', 'max:100'],
            'vendor.pincode' => ['nullable', 'string', 'max:20'],

            'items' => [$isBill ? 'required' : 'nullable', 'array', 'max:200', ...($isBill ? ['min:1'] : [])],
            'items.*.item_id' => ['nullable', Tenant::exists('items')],
            'items.*.create_item' => ['boolean'],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:1000'],
            'items.*.hsn_code' => ['nullable', 'string', 'max:20'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.rate' => ['required', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'between:0,100'],
            'items.*.tax_id' => ['nullable', Tenant::exists('taxes')],

            'expense' => [$isBill ? 'nullable' : 'required', 'array'],
            'expense.account_id' => [$isBill ? 'nullable' : 'required', Tenant::exists('accounts')->where('type', 'expense')],
            'expense.paid_through_id' => ['nullable', Tenant::exists('accounts')->where('type', 'asset')],
            'expense.amount' => [$isBill ? 'nullable' : 'required', 'numeric', 'gt:0'],
            'expense.tax_id' => ['nullable', Tenant::exists('taxes')],
            'expense.description' => ['nullable', 'string', 'max:1000'],
        ], [
            'vendor.name.required_without' => 'Vendor name is required.',
            'expense.account_id.required' => 'Choose an expense account.',
        ]);

        $result = $importer->import($data);

        return response()->json($result, 201);
    }

    public function chat(Request $request, AssistantService $assistant)
    {
        $this->allowTimeForGemini();
        $data = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:40'],
            'messages.*.role' => ['required', Rule::in(['user', 'model'])],
            'messages.*.text' => ['required', 'string', 'max:8000'],
        ]);
        $messages = array_slice($data['messages'], -20);
        // Gemini expects the conversation to start with the user.
        while ($messages && $messages[0]['role'] !== 'user') {
            array_shift($messages);
        }
        abort_if(! $messages || end($messages)['role'] !== 'user', 422, 'The last message must be from the user.');

        return $assistant->chat($request->user()->load('organization'), $messages);
    }

    /** Voice input: what the user said → lines for the open invoice / bill / estimate (nothing is saved). */
    public function parseLines(Request $request, VoiceLineParser $parser)
    {
        $this->allowTimeForGemini();
        $data = $request->validate([
            'text' => ['required', 'string', 'max:2000'],
            'type' => ['required', Rule::in(Document::TYPES)],
        ]);

        return $parser->parse($data['text'], $data['type']);
    }

    /** Shared hosts often stop PHP after 30s; Gemini calls get their own time budget (services.gemini.deadline). */
    private function allowTimeForGemini(): void
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit((int) config('services.gemini.deadline', 55) + 15);
        }
    }
}
