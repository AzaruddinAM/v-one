import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Document, RetainerSummary } from '../../core/api/models';
import { docPath } from '../../core/documents.config';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';

/** Retainer invoice: what was received as an advance, and applying it to the customer's invoices. */
@Component({
  selector: 'app-retainer-panel',
  imports: [DatePipe, FormsModule, RouterLink, Icon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (s(); as s) {
      <div class="card mt-2 no-print">
        <div class="card__header">
          <h2>Advance</h2>
          <span class="muted">Received {{ s.received | money }} · Applied {{ s.applied | money }} · <strong>Available {{ s.unapplied | money }}</strong></span>
        </div>
        @if (s.received <= 0) {
          <p class="muted" style="padding:0 20px 16px">Record the customer's payment on this retainer first. The amount received can then be applied to their invoices.</p>
        } @else if (s.unapplied > 0) {
          @if (s.invoices.length) {
            <form class="apply" (ngSubmit)="apply()">
              <label>Apply to
                <select class="select select--sm" name="inv" [(ngModel)]="invoiceId" (ngModelChange)="suggest()">
                  @for (i of s.invoices; track i.id) { <option [ngValue]="i.id">{{ i.number }} · due {{ i.balance | money }}</option> }
                </select>
              </label>
              <label>Amount <input class="input input--sm" type="number" min="0.01" step="0.01" name="amt" [(ngModel)]="amount" /></label>
              <button type="submit" class="btn btn--sm" [disabled]="busy() || !invoiceId || !(amount > 0)"><app-icon name="check" [size]="16" /> Apply</button>
            </form>
          } @else {
            <p class="muted" style="padding:0 20px 16px">This customer has no open invoices to apply the advance to.</p>
          }
        }
        @if (s.applications.length) {
          <table class="table">
            <thead><tr><th>Date</th><th>Payment #</th><th>Invoice</th><th class="text-right">Applied</th></tr></thead>
            <tbody>
              @for (a of s.applications; track a.id) {
                <tr>
                  <td>{{ a.date | date: 'dd MMM yyyy' }}</td>
                  <td>{{ a.number }}</td>
                  <td>@if (a.document) { <a [routerLink]="link('invoice', a.document.id)">{{ a.document.number }}</a> }</td>
                  <td class="text-right mono">{{ a.amount | money }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }
  `,
  styles: `
    .apply { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; padding: 0 20px 16px; }
    .apply label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--muted, #64748b); }
    .card__header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  `,
})
export class RetainerPanel implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly doc = input.required<Document>();
  readonly changed = output<void>();

  protected readonly s = signal<RetainerSummary | null>(null);
  protected readonly busy = signal(false);
  protected readonly link = docPath;
  protected invoiceId: number | null = null;
  protected amount = 0;
  private readonly id = computed(() => this.doc().id);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<RetainerSummary>(`documents/${this.id()}/retainer`).subscribe((s) => {
      this.s.set(s);
      this.invoiceId = s.invoices[0]?.id ?? null;
      this.suggest();
    });
  }

  protected suggest(): void {
    const s = this.s();
    const inv = s?.invoices.find((i) => i.id === this.invoiceId);
    this.amount = s && inv ? Math.min(s.unapplied, inv.balance) : 0;
  }

  protected apply(): void {
    if (!this.invoiceId) return;
    this.busy.set(true);
    this.api.post<RetainerSummary>(`documents/${this.id()}/apply-retainer`, { invoice_id: this.invoiceId, amount: this.amount }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Advance applied to the invoice.');
        this.load();
        this.changed.emit();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
