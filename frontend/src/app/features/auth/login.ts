import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { FieldError } from '../../shared/field-error';
import { Icon } from '../../shared/icon';
import { AuthHero } from './auth-hero';

export const PHONE_PATTERN = /^\+?[0-9\s\-()]{10,20}$/;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Icon, FieldError, AuthHero],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth.scss',
  template: `
    <app-auth-hero />
    <section class="panel">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div>
          <h1>Welcome back</h1>
          <p class="muted">Sign in with your mobile number and password.</p>
        </div>

        @if (expired()) {
          <div class="alert alert--warning"><app-icon name="alert" /> Your session expired. Please sign in again.</div>
        }
        @if (auth.error(); as error) {
          <div class="alert" role="alert"><app-icon name="alert" /> {{ error }}</div>
        }

        <div class="field">
          <label for="phone">Mobile number</label>
          <div class="input-icon">
            <app-icon name="phone" />
            <input id="phone" class="input" type="tel" inputmode="tel" autocomplete="tel" formControlName="phone" placeholder="98765 43210" />
          </div>
          <app-field-error [control]="form.controls.phone" label="Mobile number" />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <div class="input-icon">
            <app-icon name="lock" />
            <input id="password" class="input" [type]="showPassword() ? 'text' : 'password'" autocomplete="current-password" formControlName="password" placeholder="••••••••" />
            <button type="button" class="toggle" (click)="showPassword.set(!showPassword())">{{ showPassword() ? 'Hide' : 'Show' }}</button>
          </div>
          <app-field-error [control]="form.controls.password" label="Password" />
        </div>

        <button type="submit" class="btn btn--block btn--lg" [disabled]="auth.loading()">
          @if (auth.loading()) {
            <span class="spinner"></span>
          }
          Sign in
        </button>

        <p class="switch">New to v-one? <a routerLink="/register">Create a free account</a></p>
      </form>
    </section>
  `,
})
export class Login {
  protected readonly auth = inject(AuthStore);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Bound from query params via withComponentInputBinding(). */
  readonly returnUrl = input<string>();
  readonly expired = input<string>();
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.group({
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.auth.clearError();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.auth.login({ ...this.form.getRawValue(), returnUrl: this.returnUrl() });
  }
}
