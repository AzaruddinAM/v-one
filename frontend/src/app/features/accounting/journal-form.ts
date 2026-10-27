import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Journal } from '../../core/api/models';
import { LookupsStore } from '../../core/state/lookups.store';
import { ToastService } from '../../core/ui/toast.service';
import { isoDate } from '../../core/utils/dates';
import { errorMessage } from '../../core/utils/http-error';
import { round2 } from '../../core/utils/totals';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-journal-form',
  imports: [ReactiveFormsModule, RouterLink, Icon, MoneyPipe, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="id() ? 'Edit journal' : 'New journal'" />
    <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="card__body form-grid">
        <div class="field"><label class="req" for="jd">Date</label><input id="jd" class="input" type="date" formControlName="date" /></div>
        <div class="field"><label for="jr">Reference</label><input id="jr" class="input" formControlName="reference" /></div>
        <div class="field span-2"><label for="jn">Notes</label><input id="jn" class="input" formControlName="notes" /></div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Account</th><th>Description</th><th class="text-right" style="width:160px">Debit</th><th class="text-right" style="width:160px">Credit</th><th style="width:44px"></th></tr></thead>
          <tbody formArrayName="lines">
            @for (l of lines.controls; track l; let i = $index) {
              <tr [formGroupName]="i">
                <td>
                  <select class="select input--sm" formControlName="account_id">
                    <option [ngValue]="null" disabled>Select account</option>
                    @for (a of lookups.accounts(); track a.id) { <option [ngValue]="a.id">{{ a.code }} · {{ a.name }}</option> }
                  </select>
                </td>
                <td><input class="input input--sm" formControlName="description" /></td>
                <td><input class="input input--sm text-right" type="number" min="0" step="0.01" formControlName="debit" /></td>
                <td><input class="input input--sm text-right" type="number" min="0" step="0.01" formControlName="credit" /></td>
                <td><button type="button" class="btn btn--ghost btn--sm btn--icon" [disabled]="lines.length <= 2" (click)="lines.removeAt(i)" aria-label="Remove"><app-icon name="x" [size]="16" /></button></td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td><button type="button" class="btn btn--outline btn--sm" (click)="addLine()"><app-icon name="plus" [size]="16" /> Add line</button></td>
              <td class="text-right">Total</td>
              <td class="text-right mono">{{ debit() | money }}</td>
              <td class="text-right mono">{{ credit() | money }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="card__footer form-actions">
        @if (!balanced()) {
          <span class="text-danger" style="margin-right:auto">Difference: {{ debit() - credit() | money }} — debits must equal credits.</span>
        }
        <a routerLink="/accounting/journals" class="btn btn--outline">Cancel</a>
        <button type="submit" class="btn" [disabled]="!balanced() || saving()">Save journal</button>
      </div>
    </form>
  `,
})
export class JournalForm implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(LookupsStore);

  readonly id = input<string>();
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    date: [isoDate(), Validators.required],
    reference: [''],
    notes: [''],
    lines: this.fb.array([this.line(), this.line()]),
  });
  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  protected readonly debit = computed(() => round2(this.value().lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)));
  protected readonly credit = computed(() => round2(this.value().lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)));
  protected readonly balanced = computed(() => this.debit() > 0 && this.debit() === this.credit());

  get lines() {
    return this.form.controls.lines;
  }

  line(l: { account_id?: number | null; description?: string | null; debit?: number; credit?: number } = {}) {
    return this.fb.group({
      account_id: [l.account_id ?? (null as number | null), Validators.required],
      description: [l.description ?? ''],
      debit: [l.debit ?? 0],
      credit: [l.credit ?? 0],
    });
  }

  addLine(): void {
    this.lines.push(this.line());
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.api.get<Journal>(`journals/${id}`).subscribe((j) => {
        this.lines.clear();
        (j.lines ?? []).forEach((l) => this.lines.push(this.line(l)));
        this.form.patchValue({ date: j.date, reference: j.reference ?? '', notes: j.notes ?? '' });
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Select an account for every line.');
      return;
    }
    this.saving.set(true);
    const id = this.id();
    const body = this.form.getRawValue();
    (id ? this.api.put<Journal>(`journals/${id}`, body) : this.api.post<Journal>('journals', body)).subscribe({
      next: (j) => {
        this.toast.success(`Journal ${j.number} saved`);
        void this.router.navigateByUrl('/accounting/journals');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
