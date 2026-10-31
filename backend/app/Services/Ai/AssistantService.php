<?php

namespace App\Services\Ai;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Expense;
use App\Models\Item;
use App\Models\User;
use App\Services\ReportService;
use Illuminate\Support\Arr;

/**
 * v-one AI assistant: a general purpose chatbot that can also look up the
 * organization's live data through read-only Gemini function calls.
 */
class AssistantService
{
    private const MAX_ROUNDS = 6;

    public function __construct(private GeminiClient $gemini, private ReportService $reports) {}

    /**
     * @param  array<int, array{role: string, text: string}>  $history  oldest first, last one is the user's question
     * @return array{reply: string, tools: string[]}
     */
    public function chat(User $user, array $history): array
    {
        $contents = array_map(fn ($m) => [
            'role' => $m['role'] === 'user' ? 'user' : 'model',
            'parts' => [['text' => $m['text']]],
        ], $history);

        $used = [];
        for ($round = 0; $round < self::MAX_ROUNDS; $round++) {
            $content = $this->gemini->generate($contents, [
                'system' => $this->system($user),
                'tools' => [['functionDeclarations' => self::functions()]],
                'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 2048],
            ]);
            $contents[] = $content;

            $calls = array_values(array_filter($content['parts'], fn ($p) => isset($p['functionCall'])));
            if (! $calls) {
                return ['reply' => GeminiClient::text($content) ?: 'Sorry, I could not come up with an answer.', 'tools' => array_values(array_unique($used))];
            }

            $responses = [];
            foreach ($calls as $part) {
                $name = $part['functionCall']['name'];
                $used[] = $name;
                $responses[] = ['functionResponse' => [
                    'name' => $name,
                    'response' => ['result' => $this->call($name, (array) ($part['functionCall']['args'] ?? []))],
                ]];
            }
            $contents[] = ['role' => 'user', 'parts' => $responses];
        }

        return ['reply' => 'That question needed too many lookups. Please ask something more specific.', 'tools' => array_values(array_unique($used))];
    }

    private function system(User $user): string
    {
        $org = $user->organization;
        $today = today()->toDateString();
        [$fyFrom] = ReportService::period(null, null, $org->fiscal_year_start ?? 4);

        return <<<TXT
        You are "v-one Assistant", the friendly AI helper inside v-one, an accounting & GST billing app for Indian businesses.
        Organization: {$org->name}. Currency: {$org->currency} ({$org->currency_symbol}). Today: {$today}. Financial year started: {$fyFrom}.
        You are talking to {$user->name} (role: {$user->role}).

        What you can do:
        1. Answer questions about this business using the provided functions (sales, dues, overdue invoices, bills, expenses,
           stock, customers, vendors, profit & loss, GST). ALWAYS call a function for numbers — never guess or invent figures.
        2. Explain how to use v-one (see the app guide below).
        3. Help with anything else a business owner needs: draft payment-reminder emails / WhatsApp messages, quotations text,
           GST and discount calculations, accounting concepts, business tips, translations, general questions.

        Style: short, clear, friendly. Use Markdown (bold, bullet lists, small tables). Format money like {$org->currency_symbol}1,23,456.00
        (Indian grouping). Reply in the same language the user writes in (English, Hindi, Tamil, Hinglish …).
        When you mention a record, link it with a relative app link, e.g. [INV-00012](/sales/invoices/12),
        [BILL-00003](/purchases/bills/3), [Acme Traders](/customers/5) or [vendor](/vendors/7).
        You can only READ data. If the user asks you to create, edit or delete something, explain the steps or link the right page
        (e.g. [New invoice](/sales/invoices/new)). To add a bill from a photo, tell them to use [Scan bill](/purchases/scan-bill)
        or the 📎 button in this chat.

        App guide (pages):
        - Dashboard /dashboard · Customers /customers · Vendors /vendors · Items /items
        - Sales: Estimates /sales/estimates, Sales Orders /sales/orders, Invoices /sales/invoices, Credit Notes /sales/credit-notes,
          Payments Received /payments/received
        - Purchases: Purchase Orders /purchases/orders, Bills /purchases/bills, Scan bill with AI /purchases/scan-bill,
          Payments Made /payments/made, Expenses /expenses
        - Accountant: Chart of Accounts /accounting/accounts, Manual Journals /accounting/journals, Reports /reports
        - Settings /settings (organization, profile, taxes, users)
        - Record a payment: open the invoice/bill → "Record payment". Convert estimate/order to invoice: open it → "Convert".
        - Stock reduces when an invoice is sent and increases when a bill is opened; drafts don't touch stock.
        TXT;
    }

    private function call(string $name, array $a): mixed
    {
        try {
            $period = fn () => ReportService::period($a['from'] ?? null, $a['to'] ?? null, auth()->user()->organization->fiscal_year_start ?? 4);
            $limit = max(1, min(25, (int) ($a['limit'] ?? 10)));

            return match ($name) {
                'business_summary' => Arr::except($this->reports->dashboard(), ['trend', 'recent']),
                'monthly_trend' => $this->reports->dashboard()['trend'],
                'profit_and_loss' => $this->reports->profitAndLoss(...$period()),
                'receivables_aging' => $this->reports->aging('invoice'),
                'payables_aging' => $this->reports->aging('bill'),
                'sales_by_customer' => array_slice($this->reports->salesByCustomer(...$period()), 0, $limit),
                'sales_by_item' => array_slice($this->reports->salesByItem(...$period()), 0, $limit),
                'gst_summary' => $this->reports->taxSummary(...$period()),
                'inventory' => $this->inventory((bool) ($a['low_stock_only'] ?? false), $a['query'] ?? null, $limit),
                'search_contacts' => $this->contacts($a['query'] ?? '', $a['type'] ?? null, $limit),
                'list_documents' => $this->documents($a, $limit),
                'get_document' => $this->document((string) ($a['number'] ?? '')),
                'list_expenses' => $this->expenses($a, $limit),
                default => ['error' => "Unknown function $name"],
            };
        } catch (\Throwable $e) {
            report($e);

            return ['error' => 'Lookup failed: '.class_basename($e)];
        }
    }

    private function inventory(bool $lowOnly, ?string $query, int $limit): array
    {
        $q = Item::query()->with('tax:id,name,rate')
            ->when($lowOnly, fn ($q) => $q->where('track_inventory', true)->whereColumn('stock_on_hand', '<=', 'reorder_level'))
            ->when($query, fn ($q, $t) => $q->where(fn ($w) => $w->where('name', 'like', "%$t%")->orWhere('sku', 'like', "%$t%")));

        return $q->orderBy('name')->limit($limit)->get(['id', 'name', 'sku', 'type', 'unit', 'sales_price', 'purchase_price', 'track_inventory', 'stock_on_hand', 'reorder_level', 'tax_id'])->toArray();
    }

    private function contacts(string $query, ?string $type, int $limit): array
    {
        return Contact::query()
            ->when(in_array($type, ['customer', 'vendor'], true), fn ($q) => $q->where('type', $type))
            ->when(trim($query) !== '', fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', "%$query%")
                ->orWhere('company_name', 'like', "%$query%")->orWhere('phone', 'like', "%$query%")))
            ->withSum(['documents as outstanding' => fn ($d) => $d->whereIn('type', ['invoice', 'bill'])->whereNotIn('status', ['draft', 'void'])], 'balance')
            ->orderBy('name')->limit($limit)
            ->get(['id', 'type', 'name', 'company_name', 'phone', 'email', 'gstin', 'city', 'payment_terms'])->toArray();
    }

    private function documents(array $a, int $limit): array
    {
        $type = in_array($a['type'] ?? null, Document::TYPES, true) ? $a['type'] : 'invoice';
        $q = Document::where('type', $type)->with('contact:id,name')
            ->when($a['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($a['overdue_only'] ?? false, fn ($q) => $q->where('balance', '>', 0)->whereNotIn('status', ['draft', 'void'])
                ->whereNotNull('due_date')->where('due_date', '<', today()->toDateString()))
            ->when($a['unpaid_only'] ?? false, fn ($q) => $q->where('balance', '>', 0)->whereNotIn('status', ['draft', 'void']))
            ->when($a['contact'] ?? null, fn ($q, $c) => $q->whereHas('contact', fn ($w) => $w->where('name', 'like', "%$c%")))
            ->when($a['from'] ?? null, fn ($q, $d) => $q->where('date', '>=', $d))
            ->when($a['to'] ?? null, fn ($q, $d) => $q->where('date', '<=', $d));

        return [
            'count' => (clone $q)->count(),
            'total' => round((float) (clone $q)->sum('total'), 2),
            'balance' => round((float) (clone $q)->sum('balance'), 2),
            'documents' => $q->orderByDesc('date')->orderByDesc('id')->limit($limit)
                ->get(['id', 'type', 'number', 'reference', 'contact_id', 'date', 'due_date', 'status', 'total', 'balance'])->toArray(),
        ];
    }

    private function document(string $number): array
    {
        $d = Document::where('number', $number)->orWhere('reference', $number)->with(['contact:id,name,phone,email', 'items', 'payments'])->first();

        return $d ? $d->toArray() : ['error' => "No document numbered $number"];
    }

    private function expenses(array $a, int $limit): array
    {
        [$from, $to] = ReportService::period($a['from'] ?? null, $a['to'] ?? null, auth()->user()->organization->fiscal_year_start ?? 4);
        $q = Expense::whereBetween('date', [$from, $to])->with(['account:id,name', 'contact:id,name']);

        return [
            'from' => $from, 'to' => $to,
            'total' => round((float) (clone $q)->sum('total'), 2),
            'by_account' => (clone $q)->selectRaw('account_id, SUM(total) as total')->groupBy('account_id')->with('account:id,name')->get()
                ->map(fn ($r) => ['account' => $r->account?->name, 'total' => round((float) $r->total, 2)])->sortByDesc('total')->values()->all(),
            'latest' => $q->orderByDesc('date')->limit($limit)->get(['id', 'date', 'account_id', 'contact_id', 'total', 'reference', 'description'])->toArray(),
        ];
    }

    public static function functions(): array
    {
        $period = [
            'from' => ['type' => 'STRING', 'description' => 'Start date YYYY-MM-DD (default: start of financial year)'],
            'to' => ['type' => 'STRING', 'description' => 'End date YYYY-MM-DD (default: today)'],
        ];
        $limit = ['limit' => ['type' => 'INTEGER', 'description' => 'Max rows, 1-25 (default 10)']];
        $none = ['type' => 'OBJECT', 'properties' => new \stdClass];

        return [
            ['name' => 'business_summary', 'description' => 'Receivables, payables, overdue amounts, this month sales / expenses / money received, counts, top customers, low stock.', 'parameters' => $none],
            ['name' => 'monthly_trend', 'description' => 'Sales and expenses for each of the last 12 months.', 'parameters' => $none],
            ['name' => 'profit_and_loss', 'description' => 'Profit & loss statement (income, cost of goods, expenses, net profit) for a period.', 'parameters' => ['type' => 'OBJECT', 'properties' => $period]],
            ['name' => 'receivables_aging', 'description' => 'Money customers owe, grouped by customer and overdue age buckets.', 'parameters' => $none],
            ['name' => 'payables_aging', 'description' => 'Money owed to vendors, grouped by vendor and overdue age buckets.', 'parameters' => $none],
            ['name' => 'sales_by_customer', 'description' => 'Sales totals per customer for a period, highest first.', 'parameters' => ['type' => 'OBJECT', 'properties' => $period + $limit]],
            ['name' => 'sales_by_item', 'description' => 'Quantity and amount sold per item for a period, highest first.', 'parameters' => ['type' => 'OBJECT', 'properties' => $period + $limit]],
            ['name' => 'gst_summary', 'description' => 'GST output tax (sales), input tax (purchases + expenses) and net GST payable for a period.', 'parameters' => ['type' => 'OBJECT', 'properties' => $period]],
            ['name' => 'inventory', 'description' => 'Items with prices and stock on hand.', 'parameters' => ['type' => 'OBJECT', 'properties' => [
                'low_stock_only' => ['type' => 'BOOLEAN', 'description' => 'Only items at or below reorder level'],
                'query' => ['type' => 'STRING', 'description' => 'Filter by item name or SKU'],
            ] + $limit]],
            ['name' => 'search_contacts', 'description' => 'Find customers / vendors by name, company or phone, with outstanding balance.', 'parameters' => ['type' => 'OBJECT', 'properties' => [
                'query' => ['type' => 'STRING'],
                'type' => ['type' => 'STRING', 'enum' => ['customer', 'vendor']],
            ] + $limit]],
            ['name' => 'list_documents', 'description' => 'List invoices, bills, estimates, orders or credit notes with filters. Returns count, sum of totals and balances.', 'parameters' => ['type' => 'OBJECT', 'properties' => [
                'type' => ['type' => 'STRING', 'enum' => Document::TYPES],
                'status' => ['type' => 'STRING', 'description' => 'draft, sent, open, partial, paid, overdue, void, accepted, declined, closed'],
                'overdue_only' => ['type' => 'BOOLEAN'],
                'unpaid_only' => ['type' => 'BOOLEAN'],
                'contact' => ['type' => 'STRING', 'description' => 'Customer / vendor name contains'],
            ] + $period + $limit, 'required' => ['type']]],
            ['name' => 'get_document', 'description' => 'Full details (lines, payments) of one document by its number, e.g. INV-00012 or a vendor bill number.', 'parameters' => ['type' => 'OBJECT', 'properties' => [
                'number' => ['type' => 'STRING'],
            ], 'required' => ['number']]],
            ['name' => 'list_expenses', 'description' => 'Expenses for a period: total, breakdown by expense account and latest entries.', 'parameters' => ['type' => 'OBJECT', 'properties' => $period + $limit]],
        ];
    }
}
