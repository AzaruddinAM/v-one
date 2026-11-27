import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { OverdueInvoice } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { docPath } from '../../core/documents.config';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { MoneyPipe } from '../../shared/money.pipe';
import { PageHeader } from '../../shared/page-header';
import { mailtoLink, reminderText, whatsappLink } from './reminder-text';

interface CustomerGroup {
  contactId: number;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  invoices: OverdueInvoice[];
  total: number;
  maxDays: number;
  lastReminded: string | null;
}

/** Overdue invoices grouped by customer, with one-click email / WhatsApp reminders. */
@Component({
  selector: 'app-reminder-list',
  imports: [RouterLink, DatePipe, Icon, MoneyPipe, PageHeader, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Payment Reminders" subtitle="Customers with overdue invoices. Send a reminder by email or WhatsApp and we note when you did.">
      <a routerLink="/settings/organization" class="btn btn--outline btn--sm"><app-icon name="edit" [size]="16" /> Edit message</a>
    </app-page-header>

    @if (loading()) { <div class="loading-bar"></div> }

    @if (!loading() && !groups().length) {
      <div class="card"><app-empty-state icon="check" title="Nothing overdue" message="Every sent invoice is paid or not yet due." /></div>
    } @else {
      <div class="stats" style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <div class="card" style="padding:16px 20px"><small class="muted">Overdue amount</small><div class="strong mono" style="font-size:1.4rem">{{ totalOverdue() | money }}</div></div>
        <div class="card" style="padding:16px 20px"><small class="muted">Customers</small><div class="strong" style="font-size:1.4rem">{{ groups().length }}</div></div>
        <div class="card" style="padding:16px 20px"><small class="muted">Invoices</small><div class="strong" style="font-size:1.4rem">{{ count() }}</div></div>
      </div>

      @for (g of groups(); track g.contactId) {
        <div class="card" style="margin-bottom:16px">
          <div class="card__header" style="flex-wrap:wrap;gap:8px">
            <div>
              <h2 style="margin:0">{{ g.company || g.name }}</h2>
              <small class="muted">{{ g.invoices.length }} invoice(s) · up to {{ g.maxDays }} days overdue
                @if (g.lastReminded) { · last reminded {{ g.lastReminded | date: 'dd MMM yyyy, h:mm a' }} }</small>
            </div>
            <span class="spacer"></span>
            <strong class="mono" style="margin-right:12px">{{ g.total | money }}</strong>
            <a class="btn btn--outline btn--sm" [class.is-disabled]="!g.email" [attr.href]="mail(g)" (click)="sent(g, $event, !!g.email)" [attr.title]="g.email ? 'Open your email app' : 'No email saved for this customer'"><app-icon name="mail" [size]="16" /> Email</a>
            <a class="btn btn--outline btn--sm" [class.is-disabled]="!g.phone" [attr.href]="whatsapp(g)" target="_blank" rel="noopener" (click)="sent(g, $event, !!g.phone)" [attr.title]="g.phone ? 'Open WhatsApp' : 'No phone saved for this customer'"><app-icon name="phone" [size]="16" /> WhatsApp</a>
            <button type="button" class="btn btn--ghost btn--sm" (click)="copy(g)"><app-icon name="copy" [size]="16" /> Copy text</button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Due date</th><th class="text-right">Days overdue</th><th class="text-right">Reminders</th><th class="text-right">Balance due</th></tr></thead>
              <tbody>
                @for (i of g.invoices; track i.id) {
                  <tr class="is-clickable" [routerLink]="link(i.id)">
                    <td class="strong">{{ i.number }}</td>
                    <td class="nowrap">{{ i.date | date: 'dd MMM yyyy' }}</td>
                    <td class="nowrap">{{ i.due_date | date: 'dd MMM yyyy' }}</td>
                    <td class="text-right mono" [style.color]="i.days_overdue > 60 ? 'var(--danger, #dc2626)' : null">{{ i.days_overdue }}</td>
                    <td class="text-right mono">{{ i.reminder_count || '—' }}</td>
                    <td class="text-right mono strong">{{ i.balance | money }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    }
  `,
})
export class ReminderList implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);

  protected readonly loading = signal(true);
  private readonly invoices = signal<OverdueInvoice[]>([]);

  protected readonly groups = computed<CustomerGroup[]>(() => {
    const map = new Map<number, CustomerGroup>();
    for (const i of this.invoices()) {
      let g = map.get(i.contact_id!);
      if (!g) {
        g = { contactId: i.contact_id!, name: i.contact.name, company: i.contact.company_name, email: i.contact.email, phone: i.contact.phone, invoices: [], total: 0, maxDays: 0, lastReminded: null };
        map.set(i.contact_id!, g);
      }
      g.invoices.push(i);
      g.total += Number(i.balance);
      g.maxDays = Math.max(g.maxDays, i.days_overdue);
      if (i.reminded_at && (!g.lastReminded || i.reminded_at > g.lastReminded)) g.lastReminded = i.reminded_at;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  });
  protected readonly totalOverdue = computed(() => this.groups().reduce((s, g) => s + g.total, 0));
  protected readonly count = computed(() => this.invoices().length);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.get<OverdueInvoice[]>('documents/overdue').subscribe({
      next: (rows) => {
        this.invoices.set(rows);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private text(g: CustomerGroup): string {
    const org = this.auth.organization();
    return reminderText(org?.reminder_template, g.invoices, org?.name ?? '', this.auth.currency());
  }

  protected mail(g: CustomerGroup): string | null {
    if (!g.email) return null;
    const subject = `Payment reminder: ${g.invoices.map((i) => i.number).join(', ')}`;
    return mailtoLink(g.email, subject, this.text(g));
  }

  protected whatsapp(g: CustomerGroup): string | null {
    return g.phone ? whatsappLink(g.phone, this.text(g)) : null;
  }

  protected link(id: number): string {
    return docPath('invoice', id);
  }

  /** The browser opens the email / WhatsApp app; we only record that a reminder went out. */
  protected sent(g: CustomerGroup, e: Event, enabled: boolean): void {
    if (!enabled) {
      e.preventDefault();
      this.toast.error('Add an email or phone number to this customer first.');
      return;
    }
    this.markReminded(g);
  }

  protected copy(g: CustomerGroup): void {
    void navigator.clipboard?.writeText(this.text(g)).then(() => {
      this.toast.success('Reminder copied');
      this.markReminded(g);
    });
  }

  private markReminded(g: CustomerGroup): void {
    const now = new Date().toISOString();
    for (const i of g.invoices) this.api.post(`documents/${i.id}/reminded`).subscribe();
    this.invoices.update((rows) => rows.map((r) => (r.contact_id === g.contactId ? { ...r, reminded_at: now, reminder_count: (r.reminder_count ?? 0) + 1 } : r)));
  }
}
