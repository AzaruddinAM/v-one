import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Document, DocumentType, OverdueInvoice, PdfTemplateId } from '../../core/api/models';
import { isoDate } from '../../core/utils/dates';
import { mailtoLink, reminderText, whatsappLink } from '../reminders/reminder-text';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG, docPath } from '../../core/documents.config';
import { orgPdfAccent, orgPdfOptions, orgPdfTemplate, PAPER_SIZES, PDF_TEMPLATES } from '../../core/pdf-templates';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { StatusBadge } from '../../shared/status-badge';
import { PaymentDialog } from '../payments/payment-dialog';
import { DocumentSheet } from './document-sheet';
import { RetainerPanel } from './retainer-panel';

@Component({
  selector: 'app-document-view',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, StatusBadge, PaymentDialog, DocumentSheet, RetainerPanel],
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
        @if (d.type === 'delivery_challan' && d.status === 'open') {
          <button type="button" class="btn btn--outline btn--sm" (click)="setStatus('delivered')"><app-icon name="check" [size]="16" /> Mark delivered</button>
        }
        @if (overdue()) {
          <button type="button" class="btn btn--outline btn--sm" (click)="remind()" [title]="'Send a payment reminder' + (d.reminder_count ? ' (sent ' + d.reminder_count + ' time(s))' : '')"><app-icon name="bell" [size]="16" /> Remind</button>
        }
        @if (cfg().convertTo && !['void', 'closed', 'declined', 'invoiced', 'returned'].includes(d.status)) {
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
              @if (d.type === 'delivery_challan' && (d.status === 'open' || d.status === 'delivered')) {
                <button type="button" (click)="menu.set(false); setStatus('returned')"><app-icon name="return" /> Mark returned</button>
              }
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

      @if (d.recurring_profile_id) {
        <div class="alert alert--info no-print" style="margin-bottom:16px">
          Created automatically by a <a [routerLink]="recurringLink(d)">&nbsp;recurring {{ cfg().label.toLowerCase() }} profile</a>
        </div>
      }
      @if (d.converted_from) {
        <div class="alert alert--info no-print" style="margin-bottom:16px">
          Created from <a [routerLink]="link(d.converted_from.type, d.converted_from.id)">&nbsp;{{ d.converted_from.number }}</a>
        </div>
      }

      <app-document-sheet [doc]="d" [org]="org()" [template]="tpl()" [accent]="accent()" [options]="opts()" [footer]="org()?.pdf_footer" />

      @if (d.type === 'retainer_invoice' && d.status !== 'draft' && d.status !== 'void') {
        <app-retainer-panel [doc]="d" />
      }

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
  protected readonly opts = computed(() => orgPdfOptions(this.org()));
  protected readonly sendStatus = computed(() => (['invoice', 'estimate'].includes(this.docType()) ? 'sent' : 'open'));
  protected readonly overdue = computed(() => {
    const d = this.doc();
    return !!d && d.type === 'invoice' && d.balance > 0 && !!d.due_date && d.due_date < isoDate() && !['draft', 'void'].includes(d.status);
  });
  protected readonly convertLabel = computed(() => (this.cfg().convertTo ? DOC_CONFIG[this.cfg().convertTo!].label : ''));

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

  protected recurringLink(d: Document): string {
    return (d.type === 'bill' ? '/purchases/recurring-bills/' : '/sales/recurring-invoices/') + d.recurring_profile_id + '/edit';
  }

  /** Opens WhatsApp (or email when there is no phone) with the reminder text, and records it. */
  remind(): void {
    const d = this.doc();
    const c = d?.contact;
    if (!d || !c) return;
    if (!c.phone && !c.email) {
      this.toast.error('Add a phone number or email to this customer first.');
      return;
    }
    const days = Math.round((Date.now() - new Date(d.due_date + 'T00:00:00').getTime()) / 86_400_000);
    const inv = { ...d, days_overdue: days, reminder_count: d.reminder_count ?? 0, contact: c } as OverdueInvoice;
    const org = this.org();
    const text = reminderText(org?.reminder_template, [inv], org?.name ?? '', this.auth.currency());
    window.open(c.phone ? whatsappLink(c.phone, text) : mailtoLink(c.email, `Payment reminder: ${d.number}`, text), '_blank', 'noopener');
    this.api.post<{ reminder_count: number }>(`documents/${d.id}/reminded`).subscribe((r) => {
      this.doc.set({ ...d, reminder_count: r.reminder_count });
      this.toast.success('Reminder noted');
    });
  }

  protected pickTemplate(e: Event): void {
    this.picked.set((e.target as HTMLSelectElement).value as PdfTemplateId);
  }

  /** Opens the browser print dialog; "Save as PDF" there produces e.g. INV-00012.pdf. */
  print(): void {
    const previous = document.title;
    const d = this.doc();
    if (d) document.title = `${d.number}${d.contact?.name ? ' - ' + d.contact.name : ''}`;
    // Paper size for this print only (Settings → PDF templates → Paper).
    const page = document.createElement('style');
    page.textContent = `@page { size: ${PAPER_SIZES[this.opts().paper] ?? 'A4'}; margin: 12mm; }`;
    document.head.appendChild(page);
    window.print();
    page.remove();
    document.title = previous;
  }

  protected onDocClick(e: MouseEvent): void {
    if (this.menu() && !(e.target as HTMLElement).closest('.more')) this.menu.set(false);
  }
}
