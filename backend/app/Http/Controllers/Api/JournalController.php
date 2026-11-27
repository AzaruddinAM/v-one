<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Journal;
use App\Services\NumberGenerator;
use App\Support\LockDate;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JournalController extends Controller
{
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'lines' => ['required', 'array', 'min:2', 'max:100'],
            'lines.*.account_id' => ['required', Tenant::exists('accounts')],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.debit' => ['nullable', 'numeric', 'min:0'],
            'lines.*.credit' => ['nullable', 'numeric', 'min:0'],
        ]);
        $debit = round(collect($data['lines'])->sum(fn ($l) => (float) ($l['debit'] ?? 0)), 2);
        $credit = round(collect($data['lines'])->sum(fn ($l) => (float) ($l['credit'] ?? 0)), 2);
        if ($debit <= 0 || abs($debit - $credit) > 0.001) {
            throw ValidationException::withMessages(['lines' => 'Total debits must equal total credits.']);
        }
        $data['total'] = $debit;

        return $data;
    }

    private function persist(array $data, ?Journal $journal = null): Journal
    {
        LockDate::assertOpen($journal?->date, $data['date']);

        return DB::transaction(function () use ($data, $journal) {
            $lines = $data['lines'];
            unset($data['lines']);
            if ($journal) {
                $journal->update($data);
                $journal->lines()->delete();
            } else {
                $data['number'] = NumberGenerator::next(Journal::query(), 'JV-');
                $journal = Journal::create($data);
            }
            $journal->lines()->createMany(array_map(fn ($l) => [
                'account_id' => $l['account_id'], 'description' => $l['description'] ?? null,
                'debit' => (float) ($l['debit'] ?? 0), 'credit' => (float) ($l['credit'] ?? 0),
            ], $lines));

            return $journal->load('lines.account:id,code,name');
        });
    }

    public function index(Request $request)
    {
        $q = Journal::query()->withCount('lines');
        $this->search($q, $request->q, ['number', 'reference', 'notes']);

        return $this->paginate($q->orderByDesc('date')->orderByDesc('id'), $request);
    }

    public function store(Request $request)
    {
        return response()->json($this->persist($this->validated($request)), 201);
    }

    public function show(Journal $journal)
    {
        return $journal->load('lines.account:id,code,name');
    }

    public function update(Request $request, Journal $journal)
    {
        return $this->persist($this->validated($request), $journal);
    }

    public function destroy(Journal $journal)
    {
        $journal->delete();

        return response()->noContent();
    }
}
