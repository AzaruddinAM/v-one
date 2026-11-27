import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Document } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG } from '../../core/documents.config';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { blobToBase64, elementToPdf, Paper } from '../../core/utils/pdf-export';
import { Icon } from '../../shared/icon';
import { formatMoney } from '../../shared/money.pipe';
import { Modal } from '../../shared/modal';

export interface MailSettings {
  mode: 'default' | 'smtp';
  host?: string;
  port?: number;
  encryption?: 'tls' | 'ssl' | 'none';
  username?: string;
  has_password?: boolean;
  from_address?: string;
  from_name?: string;
  reply_to?: string;
  subject_template: string;
  body_template: string;
  server_ready: boolean;
  ready: boolean;
}

export interface DocumentEmailLog {
  id: number;
  to: string;
  cc?: string | null;
  subject: string;
  with_pdf: boolean;
  created_at: string;
  sender?: { id: number; name: string } | null;
}

/** Fills {type} {number} {customer} {amount} {due_date} {org} in an email template. */
export function fillTemplate(tpl: string, d: Document, org: string, currency: string): string {
  const due = d.due_date ? new Date(d.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const values: Record<string, string> = {
    type: DOC_CONFIG[d.type].label.toLowerCase(),
    Type: DOC_CONFIG[d.type].label,
    number: d.number,
    customer: d.contact?.name ?? '',
    amount: formatMoney(DOC_CONFIG[d.type].payable && d.balance > 0 ? d.balance : d.total, currency),
    total: formatMoney(d.total, currency),
    due_date: due,
    org,
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

const splitEmails = (s: string) =>
  s
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Send by email" window: To / CC / subject / message, with the PDF attached. */
@Component({
  selector: 'app-email-dialog',
  imports: [FormsModule, Modal, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="'Email ' + cfg().label.toLowerCase() + ' ' + doc().number" [width]="620" (closed)="closed.emit()">
      @if (!settings()) {
        <div class="loading-bar"></div>
      } @else if (!settings()!.ready) {
        <div class="alert alert--info">
          Email is not set up yet.
          @if (auth.isAdmin()) { Add your mail server (SMTP) in <a routerLink="/settings/email" (click)="closed.emit()">Settings → Email</a>. } @else { Ask an administrator to set it up in Settings → Email. }
        </div>
      } @else {
        <div class="form-grid one">
          <div class="field">
            <label class="req" for="em-to">To</label>
            <input id="em-to" class="input" type="text" inputmode="email" [(ngModel)]="to" placeholder="customer@example.com" />
            @if (!doc().contact?.email) { <small class="muted">This {{ cfg().contactType }} has no email saved. Type one; separate several with commas.</small> }
          </div>
          <div class="field">
            <label for="em-cc">CC</label>
            <input id="em-cc" class="input" type="text" inputmode="email" [(ngModel)]="cc" placeholder="Optional" />
          </div>
          <div class="field">
            <label class="req" for="em-subject">Subject</label>
            <input id="em-subject" class="input" [(ngModel)]="subject" maxlength="200" />
          </div>
          <div class="field">
            <label class="req" for="em-body">Message</label>
            <textarea id="em-body" class="textarea" rows="8" [(ngModel)]="body" maxlength="10000"></textarea>
          </div>
          <label class="checkbox"><input type="checkbox" [(ngModel)]="attach" /> <app-icon name="paperclip" [size]="16" /> Attach {{ doc().number }}.pdf</label>
          @if (doc().status === 'draft') {
            <label class="checkbox"><input type="checkbox" [(ngModel)]="markSent" /> Mark as {{ sentLabel() }} after sending</label>
          }
        </div>
      }
      <ng-container modal-footer>
        <button type="button" class="btn btn--outline" (click)="closed.emit()">Cancel</button>
        @if (settings()?.ready) {
          <button type="button" class="btn" (click)="send()" [disabled]="sending()">
            @if (sending()) { <span class="spinner"></span> {{ step() }} } @else { <app-icon name="send" [size]="16" /> Send }
          </button>
        }
      </ng-container>
    </app-modal>
  `,
  styles: `.one { grid-template-columns: 1fr; gap: 12px; }`,
})
export class EmailDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);

  readonly doc = input.required<Document>();
  /** The rendered document sheet, turned into the attached PDF. */
  readonly sheet = input<HTMLElement | null>(null);
  readonly paper = input<Paper>('A4');
  readonly closed = output<void>();
  readonly sent = output<{ email: DocumentEmailLog; status: string }>();

  protected readonly cfg = computed(() => DOC_CONFIG[this.doc().type]);
  protected readonly sentLabel = computed(() => (['invoice', 'estimate', 'retainer_invoice'].includes(this.doc().type) ? 'sent' : 'open'));
  protected readonly settings = signal<MailSettings | null>(null);
  protected readonly sending = signal(false);
  protected readonly step = signal('');
  protected to = '';
  protected cc = '';
  protected subject = '';
  protected body = '';
  protected attach = true;
  protected markSent = true;

  ngOnInit(): void {
    const d = this.doc();
    this.to = d.contact?.email ?? '';
    this.api.get<MailSettings>('organization/mail').subscribe({
      next: (s) => {
        const org = this.auth.organization()?.name ?? '';
        this.subject = fillTemplate(s.subject_template, d, org, this.auth.currency());
        this.body = fillTemplate(s.body_template, d, org, this.auth.currency());
        this.settings.set(s);
      },
      error: (e) => {
        this.toast.error(errorMessage(e));
        this.closed.emit();
      },
    });
  }

  async send(): Promise<void> {
    const to = splitEmails(this.to);
    const cc = splitEmails(this.cc);
    const bad = [...to, ...cc].find((e) => !EMAIL.test(e));
    if (!to.length) return this.toast.error('Enter at least one email address.');
    if (bad) return this.toast.error(`"${bad}" is not a valid email address.`);
    if (!this.subject.trim() || !this.body.trim()) return this.toast.error('Add a subject and a message.');

    this.sending.set(true);
    let pdf: string | null = null;
    const sheet = this.sheet();
    if (this.attach && sheet) {
      this.step.set('Making PDF…');
      try {
        pdf = await blobToBase64(await elementToPdf(sheet, this.paper(), this.doc().number));
      } catch {
        this.sending.set(false);
        this.toast.error('The PDF could not be made in this browser. Untick "Attach" to send without it, or try Chrome.');
        return;
      }
    }
    this.step.set('Sending…');
    this.api
      .post<{ email: DocumentEmailLog; status: string }>(`documents/${this.doc().id}/email`, {
        to,
        cc,
        subject: this.subject.trim(),
        body: this.body,
        pdf,
        mark_sent: this.doc().status === 'draft' && this.markSent,
      })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.toast.success(`Emailed to ${to.join(', ')}`);
          this.sent.emit(r);
        },
        error: (e) => {
          this.sending.set(false);
          this.toast.error(errorMessage(e));
        },
      });
  }
}
