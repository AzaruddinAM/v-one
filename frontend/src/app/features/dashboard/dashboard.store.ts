import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Dashboard } from '../../core/api/models';
import { errorMessage } from '../../core/utils/http-error';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DashboardStore = signalStore(
  withState<{ data: Dashboard | null; loading: boolean; error: string | null }>({ data: null, loading: false, error: null }),
  withComputed(({ data }) => ({
    labels: computed(() => (data()?.trend ?? []).map((t) => MONTHS[Number(t.month.slice(5, 7)) - 1])),
    sales: computed(() => (data()?.trend ?? []).map((t) => t.sales)),
    expenses: computed(() => (data()?.trend ?? []).map((t) => t.expenses)),
    yearSales: computed(() => (data()?.trend ?? []).reduce((s, t) => s + t.sales, 0)),
    yearExpenses: computed(() => (data()?.trend ?? []).reduce((s, t) => s + t.expenses, 0)),
    topMax: computed(() => Math.max(1, ...(data()?.top_customers ?? []).map((c) => c.total))),
  })),
  withMethods((store, api = inject(ApiService)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.get<Dashboard>('reports/dashboard').pipe(
            tapResponse({
              next: (data) => patchState(store, { data, loading: false }),
              error: (e) => patchState(store, { loading: false, error: errorMessage(e) }),
            }),
          ),
        ),
      ),
    ),
  })),
);
