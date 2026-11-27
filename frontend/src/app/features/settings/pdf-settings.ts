import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Organization, PdfTemplateId } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { orgPdfAccent, orgPdfTemplate, PDF_ACCENTS, PDF_TEMPLATES } from '../../core/pdf-templates';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';

/** Settings → PDF templates: default layout, accent colour and footer for invoices, estimates and other documents. */
@Component({
  selector: 'app-pdf-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
    .tpl-card { display: flex; flex-direction: column; gap: 8px; text-align: left; padding: 10px; border: 2px solid var(--border); border-radius: 12px; background: var(--surface); cursor: pointer; font: inherit; color: inherit; }
    .tpl-card:hover { border-color: var(--primary-100); }
    .tpl-card.is-on { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-50); }
    .tpl-card:disabled { cursor: default; }
    .tpl-card strong { font-size: 14px; }
    .tpl-card small { color: var(--text-2); line-height: 1.45; }
    .thumb { position: relative; height: 150px; border: 1px solid var(--border); border-radius: 6px; background: #fff; padding: 10px; display: grid; grid-template-rows: auto auto 1fr auto; gap: 7px; overflow: hidden; }
    .thumb i { display: block; height: 5px; border-radius: 3px; background: #cbd5e1; }
    .thumb .hd { display: flex; justify-content: space-between; align-items: center; }
    .thumb .hd b { width: 40%; height: 8px; border-radius: 3px; background: #334155; }
    .thumb .hd em { width: 28%; height: 10px; border-radius: 3px; background: var(--accent); }
    .thumb .meta { display: flex; justify-content: space-between; }
    .thumb .meta i { width: 34%; }
    .thumb .rows { display: grid; gap: 4px; align-content: start; }
    .thumb .rows i:first-child { height: 8px; background: #1e293b; border-radius: 2px; }
    .thumb .tot { justify-self: end; width: 40%; height: 9px; border-radius: 2px; background: #94a3b8; }
    .thumb--modern .hd { margin: -10px -10px 0; padding: 12px 10px; background: var(--accent); }
    .thumb--modern .hd b, .thumb--modern .hd em { background: #fff; }
    .thumb--modern .rows i:first-child { background: color-mix(in srgb, var(--accent) 25%, #fff); }
    .thumb--modern .tot { background: var(--accent); }
    .thumb--minimal .hd { border-bottom: 2px solid #111; padding-bottom: 6px; }
    .thumb--minimal .hd em { background: #111; height: 6px; }
    .thumb--minimal .rows i:first-child { background: none; border-bottom: 1px solid #111; border-radius: 0; }
    .thumb--minimal .tot { background: #111; }
    .thumb--gst { border: 1.5px solid #111; border-radius: 0; gap: 0; padding: 0; }
    .thumb--gst > * { padding: 7px; border-bottom: 1px solid #111; }
    .thumb--gst .hd { flex-direction: row-reverse; }
    .thumb--gst .meta i { width: 40%; }
    .thumb--gst .rows i:first-child { background: color-mix(in srgb, var(--accent) 30%, #fff); }
    .thumb--gst .tot { border-bottom: 0; width: auto; height: auto; background: none; display: flex; justify-content: flex-end; }
    .thumb--gst .tot span { display: block; width: 36%; height: 18px; border: 1px solid #111; }
    .swatches { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .swatch { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--border); cursor: pointer; padding: 0; }
    .swatch.is-on { box-shadow: 0 0 0 2px var(--text); }
    .custom { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
    .custom input { width: 36px; height: 30px; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: none; cursor: pointer; }
  `,
  template: `
    <div class="card">
      <div class="card__body">
        @if (!auth.isAdmin()) { <div class="alert alert--info" style="margin-bottom:16px">Only administrators can change the PDF template.</div> }
        <div class="form-section">
          <h3>Template</h3>
          <p class="muted" style="margin:-4px 0 14px">Used for invoices, estimates and every other document when you print or save as PDF. You can still switch template for a single document from its toolbar.</p>
          <div class="tpl-grid" [style.--accent]="accent()">
            @for (t of templates; track t.id) {
              <button type="button" class="tpl-card" [class.is-on]="template() === t.id" [disabled]="!auth.isAdmin()" (click)="template.set(t.id)" [attr.aria-pressed]="template() === t.id">
                <div class="thumb" [class]="'thumb--' + t.id" aria-hidden="true">
                  <div class="hd"><b></b><em></em></div>
                  <div class="meta"><i></i><i></i></div>
                  <div class="rows"><i></i><i></i><i></i><i></i></div>
                  <div class="tot"><span></span></div>
                </div>
                <strong>{{ t.label }}</strong>
                <small>{{ t.description }}</small>
              </button>
            }
          </div>
        </div>
        <div class="form-section">
          <h3>Accent colour</h3>
          <div class="swatches">
            @for (c of accents; track c) {
              <button type="button" class="swatch" [class.is-on]="accent() === c" [style.background]="c" [disabled]="!auth.isAdmin()" (click)="accent.set(c)" [attr.aria-label]="'Accent ' + c"></button>
            }
            <label class="custom">Custom <input type="color" [ngModel]="accent()" (ngModelChange)="accent.set($event)" [disabled]="!auth.isAdmin()" /></label>
          </div>
        </div>
        <div class="form-section">
          <h3>Footer</h3>
          <div class="field">
            <label for="pf">Printed at the bottom of every document</label>
            <textarea id="pf" class="textarea" rows="3" maxlength="1000" [ngModel]="footer()" (ngModelChange)="footer.set($event)" [disabled]="!auth.isAdmin()"
              placeholder="Bank: HDFC Bank · A/c No 50100123456789 · IFSC HDFC0001234&#10;UPI: business@okhdfc"></textarea>
            <small class="muted">Bank details, UPI ID, a thank-you line or a declaration.</small>
          </div>
        </div>
      </div>
      @if (auth.isAdmin()) {
        <div class="card__footer form-actions"><button type="button" class="btn" [disabled]="saving()" (click)="save()">Save template</button></div>
      }
    </div>
  `,
})
export class PdfSettings implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly templates = PDF_TEMPLATES;
  protected readonly accents = PDF_ACCENTS;

  protected readonly template = signal<PdfTemplateId>(orgPdfTemplate(this.auth.organization()));
  protected readonly accent = signal(orgPdfAccent(this.auth.organization()));
  protected readonly footer = signal(this.auth.organization()?.pdf_footer ?? '');
  protected readonly saving = signal(false);
  private org: Organization | null = this.auth.organization();

  ngOnInit(): void {
    this.api.get<Organization>('organization').subscribe((o) => {
      this.org = o;
      this.template.set(orgPdfTemplate(o));
      this.accent.set(orgPdfAccent(o));
      this.footer.set(o.pdf_footer ?? '');
    });
  }

  save(): void {
    if (!this.org) return;
    this.saving.set(true);
    // The organization endpoint expects the full profile, so send it back with the PDF fields changed.
    const body = { ...this.org, pdf_template: this.template(), pdf_accent: this.accent(), pdf_footer: this.footer() || null };
    this.api.put<Organization>('organization', body).subscribe({
      next: (o) => {
        this.org = o;
        this.auth.setOrganization(o);
        this.saving.set(false);
        if (o.pdf_template === undefined) {
          this.toast.error('Saved, but the database needs the PDF template upgrade first (see deploy/sql/upgrade-2026-11-pdf-templates.sql).');
        } else {
          this.toast.success('PDF template saved');
        }
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
