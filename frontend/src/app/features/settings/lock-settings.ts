import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Organization } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { isoDate } from '../../core/utils/dates';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';

/** Settings → Transaction locking: freeze the books up to a date (e.g. after filing a VAT return). */
@Component({
  selector: 'app-lock-settings',
  imports: [DatePipe, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="card__header">
        <div>
          <h2>Transaction locking</h2>
          <p class="muted">Lock the books once a period is closed or its VAT / GST return is filed. Invoices, bills, payments, expenses, credit notes and journals dated on or before the lock date can't be added, edited or deleted.</p>
        </div>
      </div>
      <div class="card__body">
        @if (current(); as d) {
          <div class="alert alert--info lock"><app-icon name="lock" [size]="18" /> Transactions up to <strong>&nbsp;{{ d | date: 'dd MMM yyyy' }}&nbsp;</strong> are locked.</div>
        } @else {
          <div class="alert lock-open"><app-icon name="lock" [size]="18" /> No lock date set. Every transaction can still be changed.</div>
        }
        @if (auth.isAdmin()) {
          <div class="row">
            <label class="field">
              <span>Lock transactions up to and including</span>
              <input class="input" type="date" [max]="today" [(ngModel)]="date" />
            </label>
            <button type="button" class="btn" (click)="save(date)" [disabled]="saving() || !date || date === current()"><app-icon name="lock" [size]="16" /> {{ current() ? 'Change lock date' : 'Lock' }}</button>
            @if (current()) { <button type="button" class="btn btn--outline" (click)="unlock()" [disabled]="saving()">Unlock all</button> }
          </div>
          <p class="muted small">Recording a payment today against an older invoice still works: only its paid status changes, not the locked invoice.</p>
        } @else {
          <div class="alert alert--info">Only administrators can lock or unlock transactions.</div>
        }
      </div>
    </div>
  `,
  styles: `
    .lock, .lock-open { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .row { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; }
    .row .field { display: flex; flex-direction: column; gap: 4px; max-width: 280px; }
    .small { font-size: 12px; margin-top: 12px; }
  `,
})
export class LockSettings {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthStore);

  protected readonly today = isoDate();
  protected readonly current = signal<string | null>(this.auth.organization()?.lock_date ?? null);
  protected readonly saving = signal(false);
  protected date = this.current() ?? '';

  async unlock(): Promise<void> {
    if (await this.confirm.ask('Unlock all transactions?', 'Every transaction can be edited or deleted again.', { confirmText: 'Unlock' })) this.save(null);
  }

  save(lock_date: string | null): void {
    this.saving.set(true);
    this.api.put<Organization>('organization/lock-date', { lock_date }).subscribe({
      next: (o) => {
        this.saving.set(false);
        this.current.set(o.lock_date ?? null);
        this.date = o.lock_date ?? '';
        this.auth.setOrganization(o);
        this.toast.success(o.lock_date ? 'Transactions locked.' : 'Transactions unlocked.');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
