import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { MailSettings } from '../documents/email-dialog';

/** Settings → Email: the mail server used to email invoices, estimates and orders, and the default message. */
@Component({
  selector: 'app-email-settings',
  imports: [FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!auth.isAdmin()) {
      <div class="alert alert--info">Only administrators can change email settings.</div>
    } @else if (s(); as v) {
      <form class="card" (ngSubmit)="save()">
        <div class="card__header">
          <div>
            <h2>Sending email</h2>
            <p class="muted">Used by the <strong>Email</strong> button on invoices, estimates, purchase orders and the rest.</p>
          </div>
        </div>
        <div class="card__body grid">
          <div class="segmented" role="radiogroup" aria-label="Mail server">
            <button type="button" [class.is-active]="v.mode === 'smtp'" (click)="v.mode = 'smtp'">My mail server (SMTP)</button>
            <button type="button" [class.is-active]="v.mode === 'default'" (click)="v.mode = 'default'">VelouraOne server</button>
          </div>

          @if (v.mode === 'default') {
            @if (v.server_ready) {
              <p class="muted">Emails go out from the VelouraOne server. Customers can reply to {{ auth.organization()?.email || 'your organization email' }}.</p>
            } @else {
              <div class="alert alert--info">The server's email isn't set up, so nothing would be delivered. Choose <strong>My mail server</strong> and enter the SMTP details of your mailbox.</div>
            }
          } @else {
            <div class="form-grid">
              <label class="field span-2"><span class="req">SMTP host</span><input class="input" name="host" [(ngModel)]="v.host" placeholder="smtp.hostinger.com" autocomplete="off" /></label>
              <label class="field"><span>Port</span><input class="input" name="port" type="number" [(ngModel)]="v.port" placeholder="465" /></label>
              <label class="field">
                <span>Security</span>
                <select class="select" name="enc" [(ngModel)]="v.encryption">
                  <option value="ssl">SSL (port 465)</option>
                  <option value="tls">TLS / STARTTLS (port 587)</option>
                  <option value="none">None</option>
                </select>
              </label>
              <label class="field span-2"><span>Username</span><input class="input" name="user" [(ngModel)]="v.username" placeholder="billing@yourcompany.com" autocomplete="off" /></label>
              <label class="field span-2">
                <span>Password</span>
                <input class="input" name="pass" type="password" [(ngModel)]="password" [placeholder]="v.has_password ? 'Saved. Leave empty to keep it' : ''" autocomplete="new-password" />
              </label>
              <label class="field span-2"><span>From address</span><input class="input" name="from" type="email" [(ngModel)]="v.from_address" [placeholder]="v.username || 'Same as username'" /></label>
            </div>
            <p class="muted small">Gmail needs an <em>app password</em> (Google account → Security → App passwords). The password is stored encrypted and never shown again.</p>
          }

          <div class="form-grid">
            <label class="field span-2"><span>Sender name</span><input class="input" name="fname" [(ngModel)]="v.from_name" [placeholder]="auth.organization()?.name ?? ''" /></label>
            <label class="field span-2"><span>Replies go to</span><input class="input" name="reply" type="email" [(ngModel)]="v.reply_to" [placeholder]="auth.organization()?.email || 'you@yourcompany.com'" /></label>
          </div>

          <h3>Default message</h3>
          <label class="field"><span>Subject</span><input class="input" name="subj" [(ngModel)]="v.subject_template" maxlength="200" /></label>
          <label class="field"><span>Message</span><textarea class="textarea" name="body" rows="7" [(ngModel)]="v.body_template" maxlength="5000"></textarea></label>
          <p class="muted small">Placeholders: <code>{{ '{' }}type{{ '}' }}</code> <code>{{ '{' }}number{{ '}' }}</code> <code>{{ '{' }}customer{{ '}' }}</code> <code>{{ '{' }}amount{{ '}' }}</code> <code>{{ '{' }}due_date{{ '}' }}</code> <code>{{ '{' }}org{{ '}' }}</code>. You can still edit the text before each send.</p>
        </div>
        <div class="card__footer form-actions">
          <button type="button" class="btn btn--outline" (click)="test()" [disabled]="busy() || !v.ready" [title]="v.ready ? 'Sends a test to ' + (auth.user()?.email || 'your email') : 'Save working settings first'">
            <app-icon name="send" [size]="16" /> Send test to me
          </button>
          <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    } @else {
      <div class="loading-bar"></div>
    }
  `,
  styles: `
    .grid { display: grid; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .small { font-size: 12.5px; margin: 0; }
    h3 { margin: 8px 0 0; font-size: 14px; }
    .segmented { justify-self: start; }
  `,
})
export class EmailSettings implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly s = signal<MailSettings | null>(null);
  protected readonly busy = signal(false);
  protected password = '';

  ngOnInit(): void {
    if (this.auth.isAdmin()) this.api.get<MailSettings>('organization/mail').subscribe((s) => this.s.set({ ...s }));
  }

  save(): void {
    const v = this.s();
    if (!v) return;
    this.busy.set(true);
    const { mode, host, port, encryption, username, from_address, from_name, reply_to, subject_template, body_template } = v;
    this.api
      .put<MailSettings>('organization/mail', {
        mode,
        host: host?.trim() || null,
        port: port || null,
        encryption,
        username: username?.trim() || null,
        password: this.password,
        from_address: from_address?.trim() || null,
        from_name: from_name?.trim() || null,
        reply_to: reply_to?.trim() || null,
        subject_template,
        body_template,
      })
      .subscribe({
        next: (s) => {
          this.busy.set(false);
          this.password = '';
          this.s.set({ ...s });
          this.toast.success('Email settings saved');
        },
        error: (e) => {
          this.busy.set(false);
          this.toast.error(errorMessage(e));
        },
      });
  }

  test(): void {
    this.busy.set(true);
    this.api.post<{ sent_to: string }>('organization/mail/test').subscribe({
      next: (r) => {
        this.busy.set(false);
        this.toast.success(`Test email sent to ${r.sent_to}. Check the inbox (and spam folder).`);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
