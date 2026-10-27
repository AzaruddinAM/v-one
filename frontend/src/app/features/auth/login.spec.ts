import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';
import { Login } from './login';
import { passwordsMatch } from './register';
import { FormControl, FormGroup } from '@angular/forms';

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function type(el: HTMLElement, selector: string, value: string) {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  it('shows validation errors and does not call the API for an invalid form', async () => {
    const { fixture, el } = await render();
    const store = TestBed.inject(AuthStore);
    const spy = vi.spyOn(store, 'login');
    type(el, '#phone', '123');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    expect(spy).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Mobile number format is invalid.');
    expect(el.textContent).toContain('Password is required.');
  });

  it('submits phone and password to the auth store', async () => {
    const { fixture, el } = await render();
    type(el, '#phone', '+91 98765 43210');
    type(el, '#password', 'Secret123');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    const req = TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.body).toEqual({ phone: '+91 98765 43210', password: 'Secret123' });
  });

  it('renders the server error from the store', async () => {
    const { fixture, el } = await render();
    type(el, '#phone', '9876543210');
    type(el, '#password', 'nope');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    TestBed.inject(HttpTestingController)
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ errors: { phone: ['Invalid phone number or password.'] } }, { status: 422, statusText: 'x' });
    await fixture.whenStable();
    expect(el.querySelector('.alert')?.textContent).toContain('Invalid phone number or password.');
  });
});

describe('passwordsMatch validator', () => {
  it('flags mismatched confirmation and clears when fixed', () => {
    const g = new FormGroup({ password: new FormControl('Secret123'), password_confirmation: new FormControl('Other123') }, { validators: passwordsMatch });
    expect(g.controls.password_confirmation.hasError('mismatch')).toBe(true);
    g.controls.password_confirmation.setValue('Secret123');
    expect(g.controls.password_confirmation.hasError('mismatch')).toBe(false);
    expect(g.valid).toBe(true);
  });
});
