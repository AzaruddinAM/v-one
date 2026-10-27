import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User } from '../api/models';
import { authInterceptor } from './auth.interceptor';
import { AUTH_STORAGE_KEY, AuthStore } from './auth.store';

const user: User = {
  id: 1,
  organization_id: 1,
  name: 'Azar Admin',
  phone: '9876543210',
  role: 'admin',
  is_active: true,
  organization: { id: 1, name: 'Acme', currency: 'INR', currency_symbol: '₹', fiscal_year_start: 4 },
};
const api = environment.apiUrl;

describe('AuthStore', () => {
  let http: HttpTestingController;
  let router: Router;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.inject(AuthStore);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => http.verify());

  it('starts signed out', () => {
    const store = setup();
    expect(store.isLoggedIn()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('logs in with phone + password, stores token and redirects', () => {
    const store = setup();
    store.login({ phone: '9876543210', password: 'Secret123', returnUrl: '/items' });
    expect(store.loading()).toBe(true);

    const req = http.expectOne(`${api}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ phone: '9876543210', password: 'Secret123' });
    req.flush({ token: 'tok-123', user });

    expect(store.isLoggedIn()).toBe(true);
    expect(store.isAdmin()).toBe(true);
    expect(store.initials()).toBe('AA');
    expect(store.currency()).toBe('INR');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/items');
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!).token).toBe('tok-123');
  });

  it('exposes the server validation message when login fails', () => {
    const store = setup();
    store.login({ phone: '9876543210', password: 'bad' });
    http.expectOne(`${api}/auth/login`).flush(
      { message: 'invalid', errors: { phone: ['Invalid phone number or password.'] } },
      { status: 422, statusText: 'Unprocessable' },
    );
    expect(store.isLoggedIn()).toBe(false);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Invalid phone number or password.');
  });

  it('restores the session from storage and refreshes the user', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: 'saved', user }));
    const store = setup();
    await Promise.resolve();
    expect(store.isLoggedIn()).toBe(true);
    const req = http.expectOne(`${api}/auth/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer saved');
    req.flush({ ...user, name: 'Renamed' });
    expect(store.user()?.name).toBe('Renamed');
  });

  it('clears state on logout and on 401 responses', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: 'saved', user }));
    const store = setup();
    await Promise.resolve();
    http.expectOne(`${api}/auth/me`).flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });
    expect(store.isLoggedIn()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1 } });
    TestBed.tick();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('logout revokes the token on the server', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: 'saved', user }));
    const store = setup();
    await Promise.resolve();
    http.expectOne(`${api}/auth/me`).flush(user);
    store.logout();
    http.expectOne(`${api}/auth/logout`).flush(null);
    expect(store.token()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
