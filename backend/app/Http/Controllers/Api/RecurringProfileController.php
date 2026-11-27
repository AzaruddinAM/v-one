<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RecurringProfile;
use App\Services\RecurringService;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RecurringProfileController extends Controller
{
    public function __construct(private RecurringService $service) {}

    private function rules(?RecurringProfile $profile = null): array
    {
        $type = $profile?->type ?? request('type');

        return [
            'type' => [$profile ? 'prohibited' : 'required', Rule::in(RecurringProfile::TYPES)],
            'name' => ['required', 'string', 'max:100'],
            'contact_id' => ['required', Tenant::exists('contacts')->where('type', $type === 'bill' ? 'vendor' : 'customer')],
            'frequency' => ['required', Rule::in(RecurringProfile::FREQUENCIES)],
            'interval' => ['nullable', 'integer', 'between:1,36'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'auto_send' => ['boolean'],
            'payment_terms' => ['nullable', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:60'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'adjustment' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'terms' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*.item_id' => ['nullable', Tenant::exists('items')],
            'items.*.name' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:1000'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.rate' => ['required', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'between:0,100'],
            'items.*.tax_id' => ['nullable', Tenant::exists('taxes')],
        ];
    }

    /** Split validated input into profile columns and the document template. */
    private function attributes(array $data, ?RecurringProfile $profile = null): array
    {
        $template = collect($data)->only(['reference', 'discount', 'adjustment', 'notes', 'terms', 'items'])->all();
        $attrs = collect($data)->except(array_keys($template))->all();
        $attrs['template'] = $template;
        $attrs['interval'] ??= 1;

        // A new start date (or a new profile) restarts the schedule from it.
        if (! $profile || $profile->start_date->toDateString() !== $data['start_date']) {
            $attrs['next_date'] = $data['start_date'];
        }

        return $attrs;
    }

    public function index(Request $request)
    {
        $request->validate(['type' => ['required', Rule::in(RecurringProfile::TYPES)]]);
        $q = RecurringProfile::where('type', $request->type)->with('contact:id,name,company_name')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s));
        $this->search($q, $request->q, ['name']);
        $q->orderBy('status')->orderBy('next_date');

        return $this->paginate($q, $request);
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $profile = RecurringProfile::create($this->attributes($data) + ['created_by' => $request->user()->id, 'status' => 'active']);
        $this->service->runDue($profile); // a start date of today (or earlier) creates the first document now

        return response()->json($this->show($profile->fresh()), 201);
    }

    public function show(RecurringProfile $recurringProfile)
    {
        return $recurringProfile->load(['contact', 'documents' => fn ($q) => $q->latest('date')->limit(50)
            ->select('id', 'type', 'number', 'date', 'due_date', 'status', 'total', 'balance', 'recurring_profile_id')]);
    }

    public function update(Request $request, RecurringProfile $recurringProfile)
    {
        $data = $request->validate($this->rules($recurringProfile));
        $attrs = $this->attributes($data, $recurringProfile);
        if ($recurringProfile->status === 'expired' && (! isset($data['end_date']) || $data['end_date'] >= today()->toDateString())) {
            $attrs['status'] = 'active';
        }
        $recurringProfile->update($attrs);

        return $this->show($recurringProfile->fresh());
    }

    public function destroy(RecurringProfile $recurringProfile)
    {
        $recurringProfile->delete(); // documents already created stay (link is nulled)

        return response()->noContent();
    }

    /** Pause or resume a profile. Resuming skips runs missed while paused. */
    public function status(Request $request, RecurringProfile $recurringProfile)
    {
        $data = $request->validate(['status' => ['required', Rule::in(['active', 'paused'])]]);
        abort_if($recurringProfile->status === 'expired', 422, 'This profile has ended. Change its end date to restart it.');

        if ($data['status'] === 'active' && $recurringProfile->status === 'paused') {
            $next = $recurringProfile->next_date;
            while ($next->lt(today())) {
                $next = $recurringProfile->advance($next);
            }
            $recurringProfile->next_date = $next;
        }
        $recurringProfile->status = $data['status'];
        $recurringProfile->save();

        return $this->show($recurringProfile);
    }

    /** Create whatever is due now (all profiles, or one with ?id=). */
    public function run(Request $request)
    {
        $only = $request->id ? RecurringProfile::findOrFail($request->id) : null;
        $docs = $only && $only->status !== 'active' ? [] : $this->service->runDue($only);

        return ['created' => count($docs), 'documents' => collect($docs)->map->only(['id', 'type', 'number', 'date', 'total'])];
    }
}
