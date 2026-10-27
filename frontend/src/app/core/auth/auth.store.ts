import { computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, pipe, tap } from 'rxjs';
import { ApiService } from '../api/api.service';
import { AuthResponse, Organization, User } from '../api/models';
import { errorMessage } from '../utils/http-error';

export const AUTH_STORAGE_KEY = 'v-one.auth';

export interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface LoginPayload {
  phone: string;
  password: string;
  returnUrl?: string;
}

export interface RegisterPayload {
  name: string;
  organization_name: string;
  phone: string;
  email?: string | null;
  password: string;
  password_confirmation: string;
}

function readStorage(): Pick<AuthState, 'token' | 'user'> {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Pick<AuthState, 'token' | 'user'>;
      if (parsed?.token) return { token: parsed.token, user: parsed.user ?? null };
    }
  } catch {
    /* storage unavailable or corrupt — start signed out */
  }
  return { token: null, user: null };
}

/**
 * Global authentication state (NgRx SignalStore).
 * Token + user are persisted to localStorage so a refresh keeps the session.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(() => ({ ...readStorage(), loading: false, error: null })),
  withComputed(({ token, user }) => ({
    isLoggedIn: computed(() => !!token()),
    organization: computed<Organization | null>(() => user()?.organization ?? null),
    role: computed(() => user()?.role ?? null),
    isAdmin: computed(() => user()?.role === 'admin'),
    canDelete: computed(() => user()?.role === 'admin' || user()?.role === 'accountant'),
    currency: computed(() => user()?.organization?.currency ?? 'INR'),
    initials: computed(() =>
      (user()?.name ?? '?')
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    ),
  })),
  withMethods((store, api = inject(ApiService), router = inject(Router)) => {
    const onAuthenticated = (res: AuthResponse, returnUrl = '/dashboard') => {
      patchState(store, { token: res.token, user: res.user, loading: false, error: null });
      void router.navigateByUrl(returnUrl);
    };
    const clear = () => patchState(store, { token: null, user: null, loading: false, error: null });

    return {
      login: rxMethod<LoginPayload>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          exhaustMap(({ returnUrl, ...credentials }) =>
            api.post<AuthResponse>('auth/login', credentials).pipe(
              tapResponse({
                next: (res) => onAuthenticated(res, returnUrl || '/dashboard'),
                error: (err) => patchState(store, { loading: false, error: errorMessage(err, 'Login failed.') }),
              }),
            ),
          ),
        ),
      ),
      register: rxMethod<RegisterPayload>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          exhaustMap((payload) =>
            api.post<AuthResponse>('auth/register', payload).pipe(
              tapResponse({
                next: (res) => onAuthenticated(res),
                error: (err) => patchState(store, { loading: false, error: errorMessage(err, 'Registration failed.') }),
              }),
            ),
          ),
        ),
      ),
      /** Re-fetch the current user (e.g. after updating organization settings). */
      refresh(): void {
        if (!store.token()) return;
        api.get<User>('auth/me').subscribe({ next: (user) => patchState(store, { user }), error: () => undefined });
      },
      setUser(user: User): void {
        patchState(store, { user });
      },
      setOrganization(organization: Organization): void {
        const user = store.user();
        if (user) patchState(store, { user: { ...user, organization } });
      },
      clearError(): void {
        patchState(store, { error: null });
      },
      logout(): void {
        if (store.token()) api.post('auth/logout').subscribe({ error: () => undefined });
        clear();
        void router.navigateByUrl('/login');
      },
      /** Called by the HTTP interceptor when the API answers 401. */
      sessionExpired(): void {
        if (!store.token()) return;
        clear();
        void router.navigate(['/login'], { queryParams: { expired: 1 } });
      },
    };
  }),
  withHooks({
    onInit(store) {
      effect(() => {
        const token = store.token();
        const user = store.user();
        try {
          if (token) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
          else localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          /* ignore quota / privacy mode errors */
        }
      });
      // Deferred: the HTTP interceptor injects this store, so calling HTTP
      // synchronously during construction would create a DI cycle.
      if (store.token()) queueMicrotask(() => store.refresh());
    },
  }),
);

export type AuthStoreType = InstanceType<typeof AuthStore>;
