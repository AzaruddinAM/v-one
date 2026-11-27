import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Document, DocumentType, PdfTemplateId } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG, docPath } from '../../core/documents.config';
import { amountInWords, orgPdfAccent, orgPdfTemplate, PDF_TEMPLATES } from '../../core/pdf-templates';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { calculateTotals } from '../../core/utils/totals';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { StatusBadge } from '../../shared/status-badge';
import { PaymentDialog } from '../payments/payment-dialog';

@Component({
  selector: 'app-document-view',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, StatusBadge, PaymentDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './document-view.scss',
  template: `
    @if (doc(); as d) {
      <div class="bar no-print">
        <a [routerLink]="cfg().path" class="btn btn--ghost btn--sm"><app-icon name="chevron-left" [size]="16" /> {{ cfg().plural }}</a>
        <h1>{{ d.number }}</h1>
        <app-status-badge [status]="d.status" />
        <span class="spacer"></span>
        @if (d.status !== 'void') {
          <a [routerLink]="[cfg().path, d.id, 'edit']" class="btn btn--outline btn--sm"><app-icon name="edit" [size]="16" /> Edit</a>
        }
        @if (d.status === 'draft') {
          <button type="button" class="btn btn--outline btn--sm" (click)="setStatus(sendStatus())"><app-icon name="send" [size]="16" /> Mark as {{ sendStatus() }}</button>
        }
        @if (cfg().payable && d.balance > 0 && d.status !== 'draft' && d.status !== 'void') {
          <button type="button" class="btn btn--success btn--sm" (click)="paying.set(true)"><app-icon name="card" [size]="16" /> Record payment</button>
        }
        @if (cfg().convertTo && d.status !== 'void' && d.status !== 'closed' && d.status !== 'declined') {
          <button type="button" class="btn btn--sm" (click)="convert()"><app-icon name="convert" [size]="16" /> Convert to {{ convertLabel() }}</button>
        }
        @if (d.type === 'estimate' && d.status === 'sent') {
          <button type="button" class="btn btn--outline btn--sm" (click)="setStatus('declined')">Mark declined</button>
        }
        <label class="tpl-pick" title="PDF template">
          <span class="sr-only">PDF template</span>
          <select class="select select--sm" [value]="tpl()" (change)="pickTemplate($event)">
            @for (t of templates; track t.id) { <option [value]="t.id">{{ t.label }}</option> }
          </select>
        </label>
        <button type="button" class="btn btn--outline btn--sm" (click)="print()" title="Print or save as PDF"><app-icon name="print" [size]="16" /> PDF / Print</button>
        <div class="more">
          <button type="button" class="btn btn--outline btn--sm btn--icon" (click)="menu.set(!menu())" aria-label="More"><app-icon name="chevron-down" [size]="16" /></button>
          @if (menu()) {
            <div class="dropdown">
              @if (d.status !== 'void' && !d.amount_paid) {
                <button type="button" (click)="voidDoc()"><app-icon name="ban" /> Void</button>
              }
              @if (auth.canDelete()) {
                <button type="button" class="danger" (click)="remove()"><app-icon name="trash" /> Delete</button>
              }
            </div>
          }
        </div>
      </div>

      @if (d.converted_from) {
        <div class="alert alert--info no-print" style="margin-bottom:16px">
          Created from <a [routerLink]="link(d.converted_from.type, d.converted_from.id)">&nbsp;{{ d.converted_from.number }}</a>
        </div>
      }

      <article class="card sheet" [class]="'tpl-' + tpl()" [style.--accent]="accent()">
        @if (d.status === 'paid') { <div class="ribbon">PAID</div> }
        <header class="sheet__head">
          <div>
            <div class="org-name">{{ org()?.name }}</div>
            <div class="muted small org-meta">
              @if (org()?.address) { {{ org()?.address }}<br /> }
              {{ orgCity() }}
              @if (org()?.gstin) { <br />GSTIN: {{ org()?.gstin }} }
              @if (org()?.phone) { <br />{{ org()?.phone }} }
            </div>
          </div>
          <div class="text-right">
            <div class="doc-title">{{ title() }}</div>
            <div class="muted"># {{ d.number }}</div>
            @if (cfg().payable) {
              <div class="due-box">
                <small>Balance due</small>
                <strong>{{ d.balance | money }}</strong>
              </div>
            }
          </div>
        </header>

        <section class="sheet__meta">
          <div>
            <small class="muted">{{ cfg().contactType === 'customer' ? 'Bill to' : 'Vendor' }}</small>
            @if (d.contact; as c) {
              <div class="strong">{{ c.name }}</div>
              <div class="muted small">
                @if (c.company_name) { {{ c.company_name }}<br /> }
                @if (c.billing_address) { <span style="white-space:pre-line">{{ c.billing_address }}</span><br /> }
                @if (c.gstin) { GSTIN: {{ c.gstin }} }
              </div>
            }
          </div>
          <dl class="dl">
            <dt>{{ cfg().label }} date</dt><dd>{{ d.date | date: 'dd MMM yyyy' }}</dd>
            @if (d.due_date) { <dt>{{ cfg().dueLabel }}</dt><dd>{{ d.due_date | date: 'dd MMM yyyy' }}</dd> }
            @if (d.reference) { <dt>Reference</dt><dd>{{ d.reference }}</dd> }
          </dl>
        </section>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>#</th><th>Item & description</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Disc</th><th class="text-right">Tax</th><th class="text-right">Amount</th></tr>
            </thead>
            <tbody>
              @for (l of d.items; track $index) {
                <tr>
                  <td class="muted">{{ $index + 1 }}</td>
                  <td><strong>{{ l.name }}</strong>@if (l.description) { <span class="sub">{{ l.description }}</span> }</td>
                  <td class="text-right mono">{{ l.quantity }} {{ l.unit }}</td>
                  <td class="text-right mono">{{ l.rate | money: false }}</td>
                  <td class="text-right mono">{{ l.discount_percent ? l.discount_percent + '%' : '—' }}</td>
                  <td class="text-right mono">{{ l.tax_rate ? l.tax_rate + '%' : '—' }}</td>
                  <td class="text-right mono">{{ l.amount | money: false }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <section class="sheet__foot">
          <div class="notes">
            <div class="words">
              <small class="muted">Amount in words</small>
              <div class="strong">{{ words() }}</div>
            </div>
            @if (d.notes) { <h4>Notes</h4><p class="muted">{{ d.notes }}</p> }
            @if (d.terms) { <h4 class="mt-2">Terms & conditions</h4><p class="muted small">{{ d.terms }}</p> }
          </div>
          <div class="sum">
            <div class="row"><span>Sub total</span><span class="mono">{{ d.subtotal | money }}</span></div>
            @for (t of breakup(); track t.rate) {
              @if (halfTax()) {
                <div class="row muted"><span>CGST &#64; {{ t.rate / 2 }}%</span><span class="mono">{{ t.amount / 2 | money }}</span></div>
                <div class="row muted"><span>SGST &#64; {{ t.rate / 2 }}%</span><span class="mono">{{ t.amount / 2 | money }}</span></div>
              } @else {
                <div class="row muted"><span>Tax &#64; {{ t.rate }}%</span><span class="mono">{{ t.amount | money }}</span></div>
              }
            }
            @if (d.discount) { <div class="row"><span>Discount</span><span class="mono">−{{ d.discount | money }}</span></div> }
            @if (d.adjustment) { <div class="row"><span>Adjustment</span><span class="mono">{{ d.adjustment | money }}</span></div> }
            <div class="row total"><span>Total</span><span class="mono">{{ d.total | money }}</span></div>
            @if (cfg().payable) {
              <div class="row"><span>Payments</span><span class="mono">−{{ d.amount_paid | money }}</span></div>
              <div class="row strong"><span>Balance due</span><span class="mono">{{ d.balance | money }}</span></div>
            }
          </div>
        </section>

        <section class="sheet__sign">
          @if (org()?.pdf_footer) { <div class="pdf-footer small">{{ org()?.pdf_footer }}</div> } @else { <div></div> }
          <div class="sign">
            <div class="sign__for">For {{ org()?.name }}</div>
            <div class="sign__line">Authorised signatory</div>
          </div>
        </section>
      </article>

      @if (cfg().payable && d.payments?.length) {
        <div class="card mt-2 no-print">
          <div class="card__header"><h2>Payments</h2></div>
          <table class="table">
            <thead><tr><th>Date</th><th>Payment #</th><th>Mode</th><th>Reference</th><th class="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              @for (p of d.payments; track p.id) {
                <tr>
                  <td>{{ p.date | date: 'dd MMM yyyy' }}</td>
                  <td>{{ p.number }}</td>
                  <td style="text-transform:capitalize">{{ p.mode.replace('_', ' ') }}</td>
                  <td>{{ p.reference || '—' }}</td>
                  <td class="text-right mono">{{ p.amount | money }}</td>
                  <td class="actions">
                    @if (auth.canDelete()) {
                      <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="deletePayment(p.id)" aria-label="Delete payment"><app-icon name="trash" [size]="16" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (paying()) {
        <app-payment-dialog [direction]="d.type === 'bill' ? 'out' : 'in'" [document]="d" (closed)="paying.set(false)" (saved)="paying.set(false); load()" />
      }
    } @else {
      <div class="loading-bar"></div>
    }
  `,
  host: { '(document:click)': 'onDocClick($event)' },
})
export class DocumentView implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthStore);

  readonly id = input.required<string>();
  readonly docType = input<DocumentType>('invoice');

  protected readonly doc = signal<Document | null>(null);
  protected readonly paying = signal(false);
  protected readonly menu = signal(false);
  protected readonly cfg = computed(() => DOC_CONFIG[this.docType()]);
  protected readonly org = this.auth.organization;
  protected readonly link = docPath;
  protected readonly templates = PDF_TEMPLATES;
  /** Template used on screen and in the PDF: the organization default, or a one-off pick from the toolbar. */
  private readonly picked = signal<PdfTemplateId | null>(null);
  protected readonly tpl = computed<PdfTemplateId>(() => this.picked() ?? orgPdfTemplate(this.org()));
  protected readonly accent = computed(() => orgPdfAccent(this.org()));
  protected readonly words = computed(() => amountInWords(this.doc()?.total ?? 0, this.auth.currency()));
  protected readonly orgCity = computed(() => {
    const o = this.org();
    return [o?.city, o?.state, o?.pincode].filter((v) => !!v).join(', ');
  });
  protected readonly sendStatus = computed(() => (['invoice', 'estimate'].includes(this.docType()) ? 'sent' : 'open'));
  protected readonly convertLabel = computed(() => (this.cfg().convertTo ? DOC_CONFIG[this.cfg().convertTo!].label : ''));
  protected readonly title = computed(() => {
    const d = this.doc();
    if (d?.type === 'invoice') return this.org()?.gstin ? 'TAX INVOICE' : 'INVOICE';
    return this.cfg().label.toUpperCase();
  });
  /** Intra-state GST shows CGST + SGST split. */
  protected readonly halfTax = computed(() => {
    const o = this.org();
    const c = this.doc()?.contact;
    return !!o?.gstin && (!c?.state || !o.state || c.state.toLowerCase() === o.state.toLowerCase());
  });
  protected readonly breakup = computed(() => {
    const d = this.doc();
    return d ? calculateTotals(d.items ?? []).taxBreakup : [];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<Document>(`documents/${this.id()}`).subscribe({
      next: (d) => this.doc.set(d),
      error: (e) => {
        this.toast.error(errorMessage(e));
        void this.router.navigateByUrl(this.cfg().path);
      },
    });
  }

  setStatus(status: string): void {
    this.api.post<Document>(`documents/${this.id()}/status`, { status }).subscribe({
      next: () => {
        this.toast.success('Status updated');
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  async voidDoc(): Promise<void> {
    this.menu.set(false);
    if (await this.confirm.ask('Void this document?', 'It will be excluded from reports and stock will be restored.', { confirmText: 'Void', danger: true })) {
      this.setStatus('void');
    }
  }

  async remove(): Promise<void> {
    this.menu.set(false);
    if (await this.confirm.ask('Delete permanently?', 'Linked payments will be removed. This cannot be undone.', { confirmText: 'Delete', danger: true })) {
      this.api.delete(`documents/${this.id()}`).subscribe({
        next: () => {
          this.toast.success('Deleted');
          void this.router.navigateByUrl(this.cfg().path);
        },
        error: (e) => this.toast.error(errorMessage(e)),
      });
    }
  }

  convert(): void {
    this.api.post<Document>(`documents/${this.id()}/convert`).subscribe({
      next: (d) => {
        this.toast.success(`${DOC_CONFIG[d.type].label} ${d.number} created`);
        void this.router.navigateByUrl(docPath(d.type, d.id) + '/edit');
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  async deletePayment(id: number): Promise<void> {
    if (await this.confirm.ask('Delete payment?', 'The balance due will be updated.', { confirmText: 'Delete', danger: true })) {
      this.api.delete(`payments/${id}`).subscribe({ next: () => this.load(), error: (e) => this.toast.error(errorMessage(e)) });
    }
  }

  protected pickTemplate(e: Event): void {
    this.picked.set((e.target as HTMLSelectElement).value as PdfTemplateId);
  }

  /** Opens the browser print dialog; "Save as PDF" there produces e.g. INV-00012.pdf. */
  print(): void {
    const previous = document.title;
    const d = this.doc();
    if (d) document.title = `${d.number}${d.contact?.name ? ' - ' + d.contact.name : ''}`;
    window.print();
    document.title = previous;
  }

  protected onDocClick(e: MouseEvent): void {
    if (this.menu() && !(e.target as HTMLElement).closest('.more')) this.menu.set(false);
  }
}
