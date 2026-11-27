import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { DocumentType, NumberSeries, Organization } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG } from '../../core/documents.config';
import { previewNumber } from '../../core/number-series';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';

interface Row extends NumberSeries {
  type: DocumentType;
  label: string;
  custom: boolean;
}

const ORDER: DocumentType[] = ['invoice', 'estimate', 'sales_order', 'delivery_challan', 'credit_note', 'purchase_order', 'bill', 'vendor_credit'];

/** Settings → Transaction numbers: Zoho-style prefixes with placeholders and a running number. */
@Component({
  selector: 'app-numbering-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="card__header">
        <div>
          <h2>Transaction number series</h2>
          <p class="muted">Turn on a custom series to number documents your way, e.g. <code>INV-{{ '{YY}' }}-{{ '{CODE}' }}-</code> gives INV-26-TU-2630.
            Placeholders: <code>{{ '{YYYY}' }}</code> year, <code>{{ '{YY}' }}</code> short year, <code>{{ '{MM}' }}</code> month,
            <code>{{ '{FY}' }}</code> financial year (26-27), <code>{{ '{CODE}' }}</code> the customer's / vendor's short code (or initials).
            The running number is shared by every prefix of the type, and continues after any higher number you type by hand.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Document</th><th style="width:90px">Custom</th><th>Prefix</th><th style="width:140px">Next number</th><th style="width:100px">Digits</th><th>Preview</th></tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.type) {
              <tr>
                <td class="strong">{{ r.label }}</td>
                <td><input type="checkbox" [(ngModel)]="r.custom" [disabled]="!auth.isAdmin()" [attr.aria-label]="'Custom numbering for ' + r.label" (ngModelChange)="touch()" /></td>
                <td><input class="input input--sm" [(ngModel)]="r.prefix" [disabled]="!r.custom || !auth.isAdmin()" maxlength="30" (ngModelChange)="touch()" [attr.aria-label]="r.label + ' prefix'" /></td>
                <td><input class="input input--sm" type="number" min="1" [(ngModel)]="r.next" [disabled]="!r.custom || !auth.isAdmin()" (ngModelChange)="touch()" [attr.aria-label]="r.label + ' next number'" /></td>
                <td><input class="input input--sm" type="number" min="1" max="10" [(ngModel)]="r.digits" [disabled]="!r.custom || !auth.isAdmin()" (ngModelChange)="touch()" [attr.aria-label]="r.label + ' digits'" /></td>
                <td class="mono">{{ preview(r) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="card__body">
        <label class="field" style="max-width:260px">
          <span>Preview with customer code</span>
          <input class="input input--sm" [(ngModel)]="sampleCode" maxlength="12" (ngModelChange)="touch()" />
        </label>
      </div>
      @if (auth.isAdmin()) {
        <div class="card__footer form-actions"><button type="button" class="btn" (click)="save()" [disabled]="saving()">Save numbering</button></div>
      } @else {
        <div class="card__body"><div class="alert alert--info">Only administrators can change numbering.</div></div>
      }
    </div>
  `,
})
export class NumberingSettings implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly rows = signal<Row[]>([]);
  protected readonly saving = signal(false);
  protected sampleCode = 'TU';
  private org: Organization | null = null;

  ngOnInit(): void {
    this.api.get<Organization>('organization').subscribe((o) => {
      this.org = o;
      this.rows.set(
        ORDER.map((type) => {
          const s = o.number_series?.[type];
          const def = { prefix: DOC_CONFIG[type].label === 'Invoice' ? 'INV-{YY}-{CODE}-' : defaultPrefix(type), next: 1, digits: 5 };
          return { type, label: DOC_CONFIG[type].plural, custom: !!s?.prefix, ...def, ...(s?.prefix ? s : {}) };
        }),
      );
    });
  }

  /** Signals don't see in-place ngModel edits; re-emit so previews refresh. */
  protected touch(): void {
    this.rows.update((r) => [...r]);
  }

  protected preview(r: Row): string {
    if (!r.custom || !r.prefix.trim()) return `${defaultPrefix(r.type)}00001 (default)`;
    return previewNumber(r, new Date(), this.sampleCode, this.org?.fiscal_year_start ?? 4);
  }

  save(): void {
    if (!this.org) return;
    const number_series: Partial<Record<DocumentType, NumberSeries>> = {};
    for (const r of this.rows()) {
      number_series[r.type] = r.custom ? { prefix: r.prefix.trim(), next: Number(r.next) || 1, digits: Number(r.digits) || 5 } : { prefix: '', next: 1, digits: 5 };
    }
    const { id: _id, ...org } = this.org;
    this.saving.set(true);
    this.api.put<Organization>('organization', { ...org, number_series }).subscribe({
      next: (o) => {
        this.org = o;
        this.auth.setOrganization(o);
        this.saving.set(false);
        this.toast.success('Numbering saved');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}

const PREFIX: Record<DocumentType, string> = {
  estimate: 'EST-', sales_order: 'SO-', delivery_challan: 'DC-', invoice: 'INV-', credit_note: 'CN-', purchase_order: 'PO-', bill: 'BILL-', vendor_credit: 'VC-',
};

function defaultPrefix(type: DocumentType): string {
  return PREFIX[type];
}
