import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStoreFeature, withComputed, withMethods, withState } from '@ngrx/signals';
import { removeEntity, setAllEntities, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Observable, debounceTime, distinctUntilChanged, pipe, switchMap, tap } from 'rxjs';
import { ApiService, QueryParams } from '../api/api.service';
import { errorMessage } from '../utils/http-error';

export interface ListState {
  endpoint: string;
  filters: QueryParams;
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

/**
 * Reusable SignalStore feature for server-side paginated, filterable lists.
 * Each list page provides its own store instance (component-level provider),
 * so state is isolated per screen and garbage-collected when the user leaves.
 */
export function withPaginatedList<T extends { id: number }>(endpoint: string, filters: QueryParams = {}) {
  return signalStoreFeature(
    withEntities<T>(),
    withState<ListState>({
      endpoint,
      filters,
      page: 1,
      perPage: 20,
      total: 0,
      lastPage: 1,
      loading: false,
      loaded: false,
      error: null,
    }),
    withComputed(({ total, page, perPage, entities, loaded, filters }) => ({
      /** Column filters (f_*) or search typed in: an empty result then means "no matches", not "nothing yet". */
      isFiltering: computed(() => Object.entries(filters()).some(([k, v]) => (k.startsWith('f_') || k === 'q') && v !== '' && v != null)),
      /** Current sort as { field, dir }, from ?sort=field / -field. */
      sortState: computed(() => {
        const s = String(filters()['sort'] ?? '');
        return s ? { field: s.replace(/^-/, ''), dir: s.startsWith('-') ? ('desc' as const) : ('asc' as const) } : null;
      }),
      isEmpty: computed(() => loaded() && entities().length === 0),
      rangeLabel: computed(() => {
        if (!total()) return '0 results';
        const from = (page() - 1) * perPage() + 1;
        const to = Math.min(total(), page() * perPage());
        return `${from}–${to} of ${total()}`;
      }),
    })),
    withMethods((store, api = inject(ApiService)) => {
      const fetch = (): Observable<unknown> =>
        api.list<T>(store.endpoint(), { ...store.filters(), page: store.page(), per_page: store.perPage() }).pipe(
          tapResponse({
            next: (res) =>
              patchState(store, setAllEntities(res.data), {
                total: res.total,
                lastPage: res.last_page,
                page: res.current_page,
                loading: false,
                loaded: true,
              }),
            error: (err) => patchState(store, { loading: false, loaded: true, error: errorMessage(err) }),
          }),
        );

      const load = rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() => fetch()),
        ),
      );

      const search = rxMethod<string>(
        pipe(
          debounceTime(300),
          distinctUntilChanged(),
          tap((q) => patchState(store, { filters: { ...store.filters(), q }, page: 1 })),
          tap(() => load()),
        ),
      );

      /** Column header filters, debounced so typing doesn't fire a request per key. */
      const reloadSoon = rxMethod<void>(pipe(debounceTime(350), tap(() => load())));
      const filterColumn = (key: string, value: string): void => {
        // Record the value at once (so quick typing in two boxes keeps both) and only debounce the request.
        patchState(store, { filters: { ...store.filters(), ['f_' + key]: String(value ?? '').trim() }, page: 1 });
        reloadSoon();
      };

      return {
        load,
        search,
        filterColumn,
        /** Click on a column header: ascending → descending → back to the default order. */
        toggleSort(field: string): void {
          const cur = String(store.filters()['sort'] ?? '');
          const next = cur === field ? '-' + field : cur === '-' + field ? '' : field;
          patchState(store, { filters: { ...store.filters(), sort: next }, page: 1 });
          load();
        },
        clearColumnFilters(): void {
          const kept = Object.fromEntries(Object.entries(store.filters()).filter(([k]) => !k.startsWith('f_')));
          patchState(store, { filters: kept, page: 1 });
          load();
        },
        setFilters(f: QueryParams): void {
          patchState(store, { filters: { ...store.filters(), ...f }, page: 1 });
          load();
        },
        goTo(page: number): void {
          if (page < 1 || page > store.lastPage() || page === store.page()) return;
          patchState(store, { page });
          load();
        },
        setPerPage(perPage: number): void {
          patchState(store, { perPage, page: 1 });
          load();
        },
        /** Optimistic removal; reloads on failure. */
        remove(id: number, onError?: (msg: string) => void): void {
          patchState(store, removeEntity(id), { total: Math.max(0, store.total() - 1) });
          api.delete(`${store.endpoint()}/${id}`).subscribe({
            error: (err) => {
              onError?.(errorMessage(err));
              load();
            },
          });
        },
      };
    }),
  );
}
