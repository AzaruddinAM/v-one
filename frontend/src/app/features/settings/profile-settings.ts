import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { User } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { FieldError } from '../../shared/field-error';
import { passwordsMatch } from '../auth/register';

@Component({
  selector: 'app-profile-settings',
  imports: [ReactiveFormsModule, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid-2">
      <form class="card" [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
        <div class="card__header"><h2>Profile</h2></div>
        <div class="card__body form-grid" style="grid-template-columns:1fr">
          <div class="field"><label>Mobile number (login)</label><input class="input" [value]="auth.user()?.phone" disabled /></div>
          <div class="field">
            <label class="req" for="pn">Name</label>
            <input id="pn" class="input" formControlName="name" />
            <app-field-error [control]="profile.controls.name" label="Name" />
          </div>
          <div class="field"><label for="pe">Email</label><input id="pe" class="input" type="email" formControlName="email" /></div>
          <div class="field"><label>Role</label><input class="input" [value]="auth.role()" disabled style="text-transform:capitalize" /></div>
        </div>
        <div class="card__footer form-actions"><button type="submit" class="btn">Save profile</button></div>
      </form>

      <form class="card" [formGroup]="password" (ngSubmit)="savePassword()" novalidate>
        <div class="card__header"><h2>Change password</h2></div>
        <div class="card__body form-grid" style="grid-template-columns:1fr">
          <div class="field">
            <label class="req" for="cp">Current password</label>
            <input id="cp" class="input" type="password" formControlName="current_password" autocomplete="current-password" />
            <app-field-error [control]="password.controls.current_password" label="Current password" [server]="errors()['current_password']" />
          </div>
          <div class="field">
            <label class="req" for="np">New password</label>
            <input id="np" class="input" type="password" formControlName="password" autocomplete="new-password" />
            <app-field-error [control]="password.controls.password" label="Password" [server]="errors()['password']" />
          </div>
          <div class="field">
            <label class="req" for="npc">Confirm new password</label>
            <input id="npc" class="input" type="password" formControlName="password_confirmation" autocomplete="new-password" />
            <app-field-error [control]="password.controls.password_confirmation" label="Confirmation" />
          </div>
        </div>
        <div class="card__footer form-actions"><button type="submit" class="btn">Update password</button></div>
      </form>
    </div>
  `,
})
export class ProfileSettings {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthStore);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly profile = this.fb.group({
    name: [this.auth.user()?.name ?? '', Validators.required],
    email: [this.auth.user()?.email ?? '', Validators.email],
  });

  protected readonly password = this.fb.group(
    {
      current_password: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  saveProfile(): void {
    if (this.profile.invalid) return this.profile.markAllAsTouched();
    this.api.put<User>('auth/profile', this.profile.getRawValue()).subscribe({
      next: (u) => {
        this.auth.setUser(u);
        this.toast.success('Profile updated');
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  savePassword(): void {
    if (this.password.invalid) return this.password.markAllAsTouched();
    this.api.put('auth/password', this.password.getRawValue()).subscribe({
      next: () => {
        this.password.reset();
        this.errors.set({});
        this.toast.success('Password changed');
      },
      error: (e) => {
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }
}
