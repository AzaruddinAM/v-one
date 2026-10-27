import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Role, User } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils/http-error';
import { FieldError } from '../../shared/field-error';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { StatusBadge } from '../../shared/status-badge';
import { PHONE_PATTERN } from '../auth/login';

@Component({
  selector: 'app-user-settings',
  imports: [ReactiveFormsModule, DatePipe, Icon, Modal, FieldError, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="card__header">
        <div><h2>Users & roles</h2><p class="muted">Admins manage everything · Accountants can edit and delete · Staff can create and view.</p></div>
        <button type="button" class="btn" (click)="open()"><app-icon name="plus" /> Invite user</button>
      </div>
      <table class="table">
        <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
        <tbody>
          @for (u of users(); track u.id) {
            <tr>
              <td><div class="gap"><div class="avatar">{{ u.name.charAt(0) }}</div><div><strong>{{ u.name }}</strong><span class="sub">{{ u.email }}</span></div></div></td>
              <td>{{ u.phone }}</td>
              <td><span class="chip" style="text-transform:capitalize">{{ u.role }}</span></td>
              <td><app-status-badge [status]="u.is_active ? 'active' : 'inactive'" /></td>
              <td class="muted">{{ u.last_login_at ? (u.last_login_at | date: 'dd MMM yyyy, HH:mm') : 'Never' }}</td>
              <td class="actions">
                <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="open(u)" aria-label="Edit"><app-icon name="edit" [size]="16" /></button>
                @if (u.id !== auth.user()?.id) {
                  <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(u)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (editing()) {
      <app-modal [title]="editingUser() ? 'Edit user' : 'Invite user'" (closed)="editing.set(false)">
        <form id="user-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
          <div class="field span-all">
            <label class="req" for="un">Name</label>
            <input id="un" class="input" formControlName="name" />
            <app-field-error [control]="form.controls.name" label="Name" />
          </div>
          <div class="field">
            <label class="req" for="up">Mobile number</label>
            <input id="up" class="input" type="tel" formControlName="phone" />
            <app-field-error [control]="form.controls.phone" label="Mobile number" [server]="errors()['phone']" />
          </div>
          <div class="field"><label for="ue">Email</label><input id="ue" class="input" type="email" formControlName="email" /></div>
          <div class="field">
            <label for="ur">Role</label>
            <select id="ur" class="select" formControlName="role">
              <option value="admin">Admin</option>
              <option value="accountant">Accountant</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div class="field">
            <label [class.req]="!editingUser()" for="upw">{{ editingUser() ? 'New password (optional)' : 'Password' }}</label>
            <input id="upw" class="input" type="password" formControlName="password" autocomplete="new-password" />
            <app-field-error [control]="form.controls.password" label="Password" [server]="errors()['password']" />
          </div>
          @if (editingUser()) { <label class="checkbox"><input type="checkbox" formControlName="is_active" /> Active</label> }
        </form>
        <ng-container modal-footer>
          <button type="button" class="btn btn--outline" (click)="editing.set(false)">Cancel</button>
          <button type="submit" form="user-form" class="btn">Save</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class UserSettings implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthStore);
  protected readonly users = signal<User[]>([]);
  protected readonly editing = signal(false);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: [''],
    role: ['staff' as Role],
    password: [''],
    is_active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<User[]>('users').subscribe((u) => this.users.set(u));
  }

  open(u?: User): void {
    this.errors.set({});
    this.editingUser.set(u ?? null);
    this.form.reset({ name: u?.name ?? '', phone: u?.phone ?? '', email: u?.email ?? '', role: u?.role ?? 'staff', password: '', is_active: u?.is_active ?? true });
    this.form.controls.password.setValidators(u ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.editing.set(true);
  }

  save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const u = this.editingUser();
    const body = this.form.getRawValue();
    (u ? this.api.put<User>(`users/${u.id}`, body) : this.api.post<User>('users', body)).subscribe({
      next: () => {
        this.toast.success('User saved');
        this.editing.set(false);
        this.load();
      },
      error: (e) => {
        this.errors.set(fieldErrors(e));
        this.toast.error(errorMessage(e));
      },
    });
  }

  async remove(u: User): Promise<void> {
    if (await this.confirm.ask(`Remove ${u.name}?`, 'They will no longer be able to sign in.', { confirmText: 'Remove', danger: true })) {
      this.api.delete(`users/${u.id}`).subscribe({ next: () => this.load(), error: (e) => this.toast.error(errorMessage(e)) });
    }
  }
}
