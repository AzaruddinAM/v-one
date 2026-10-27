import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { adminGuard, authGuard, guestGuard } from './auth.guards';
import { AuthStore } from './auth.store';

describe('auth guards', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/sales/invoices' } as RouterStateSnapshot;
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    store = TestBed.inject(AuthStore);
  });

  const run = (guard: typeof authGuard) => TestBed.runInInjectionContext(() => guard(route, state));

  it('authGuard redirects anonymous users to /login with returnUrl', () => {
    const result = run(authGuard) as UrlTree;
    expect(result.toString()).toBe('/login?returnUrl=%2Fsales%2Finvoices');
  });

  it('authGuard allows signed-in users', () => {
    patchState(unprotected(store), { token: 't' });
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard sends signed-in users to the dashboard', () => {
    expect(run(guestGuard)).toBe(true);
    patchState(unprotected(store), { token: 't' });
    expect((run(guestGuard) as UrlTree).toString()).toBe('/dashboard');
  });

  it('adminGuard only allows admins', () => {
    patchState(unprotected(store), { token: 't', user: { id: 1, organization_id: 1, name: 'S', phone: '1', role: 'staff', is_active: true } });
    expect((run(adminGuard) as UrlTree).toString()).toBe('/dashboard');
    patchState(unprotected(store), { user: { ...store.user()!, role: 'admin' } });
    expect(run(adminGuard)).toBe(true);
  });
});
