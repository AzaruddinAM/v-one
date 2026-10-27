import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { filter, pipe, switchMap, tap } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Lookups } from '../api/models';

interface LookupsState {
  data: Lookups | null;
  loading: boolean;
}

/** Reference data (taxes, chart of accounts, units…) loaded once per session and shared app-wide. */
export const LookupsStore = signalStore(
  { providedIn: 'root' },
  withState<LookupsState>({ data: null, loading: false }),
  withComputed(({ data }) => ({
    taxes: computed(() => data()?.taxes ?? []),
    accounts: computed(() => data()?.accounts ?? []),
    expenseAccounts: computed(() => (data()?.accounts ?? []).filter((a) => a.type === 'expense')),
    paymentAccounts: computed(() =>
      (data()?.accounts ?? []).filter((a) => a.type === 'asset' && (a.sub_type === 'cash' || a.sub_type === 'bank')),
    ),
    paymentModes: computed(() => data()?.payment_modes ?? ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other']),
    units: computed(() => data()?.units ?? ['pcs']),
    taxRates: computed(() => new Map((data()?.taxes ?? []).map((t) => [t.id, t.rate]))),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    load: rxMethod<{ force?: boolean } | void>(
      pipe(
        filter((opts) => !!(opts && opts.force) || (!store.data() && !store.loading())),
        tap(() => patchState(store, { loading: true })),
        switchMap(() =>
          api.get<Lookups>('lookups').pipe(
            tapResponse({
              next: (data) => patchState(store, { data, loading: false }),
              error: () => patchState(store, { loading: false }),
            }),
          ),
        ),
      ),
    ),
    taxRate(id: number | null | undefined): number {
      return id ? (store.taxRates().get(Number(id)) ?? 0) : 0;
    },
    reset(): void {
      patchState(store, { data: null, loading: false });
    },
  })),
);
