import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Document, Organization, PdfOptions, PdfTemplateId } from '../../core/api/models';
import { taxProfile } from '../../core/tax-regime';
import { AuthStore } from '../../core/auth/auth.store';
import { DEFAULT_PDF_OPTIONS, orgPdfAccent, orgPdfOptions, orgPdfTemplate, PDF_ACCENTS, PDF_TEMPLATES } from '../../core/pdf-templates';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { resizeImage } from '../../core/utils/image';
import { DocumentSheet } from '../documents/document-sheet';

type Flag = { [K in keyof PdfOptions]: PdfOptions[K] extends boolean ? K : never }[keyof PdfOptions];

const SAMPLE: Document = {
  id: 0,
  type: 'invoice',
  number: 'INV-00042',
  date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10),
  reference: 'PO-7781',
  status: 'sent',
  contact_id: 0,
  contact: { id: 0, type: 'customer', name: 'Ravi Stores', company_name: 'Ravi General Stores', billing_address: '14 Market Road\nKochi, Kerala 682001', gstin: '32AAACR1234K1Z2', state: 'Kerala' } as never,
  items: [
    { name: 'A4 Paper 75 GSM', description: '500 sheets per ream', quantity: 10, unit: 'ream', rate: 245, discount_percent: 5, tax_rate: 12, amount: 2327.5 },
    { name: 'Gel Pen Blue', description: 'Box of 10', quantity: 6, unit: 'box', rate: 120, discount_percent: 0, tax_rate: 18, amount: 720 },
    { name: 'Delivery', description: null, quantity: 1, unit: '', rate: 150, discount_percent: 0, tax_rate: 18, amount: 150 },
  ],
  subtotal: 3197.5,
  discount: 0,
  tax_total: 433.9,
  adjustment: -0.4,
  total: 3631,
  amount_paid: 1000,
  balance: 2631,
  notes: 'Thank you for your business!',
  terms: 'Goods once sold will not be taken back. Interest @18% p.a. on overdue bills.',
} as Document;

/** Settings → PDF templates: layout, colours, logo, header, columns, footer, signature and paper for every printed document. */
@Component({
  selector: 'app-pdf-settings',
  imports: [FormsModule, DocumentSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pdf-settings.scss',
  template: `
    <div class="layout">
      <div class="card">
        <div class="card__body">
          @if (!auth.isAdmin()) { <div class="alert alert--info" style="margin-bottom:16px">Only administrators can change PDF settings.</div> }
          <fieldset [disabled]="!auth.isAdmin()">
            <div class="form-section">
              <h3>Template</h3>
              <p class="muted hint">Used for invoices, estimates and every other document when you print or save as PDF. You can still switch template for one document from its toolbar.</p>
              <div class="tpl-grid" [style.--accent]="accent()">
                @for (t of templates; track t.id) {
                  <button type="button" class="tpl-card" [class.is-on]="template() === t.id" (click)="template.set(t.id)" [attr.aria-pressed]="template() === t.id">
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
              <h3>Colour & font</h3>
              <div class="swatches">
                @for (c of accents; track c) {
                  <button type="button" class="swatch" [class.is-on]="accent() === c" [style.background]="c" (click)="accent.set(c)" [attr.aria-label]="'Accent ' + c"></button>
                }
                <label class="custom">Custom <input type="color" [ngModel]="accent()" (ngModelChange)="accent.set($event)" /></label>
              </div>
              <div class="form-grid mt-2">
                <div class="field">
                  <label for="pfont">Font</label>
                  <select id="pfont" class="select" [ngModel]="o().font" (ngModelChange)="set('font', $event)">
                    <option value="sans">Sans serif (modern)</option>
                    <option value="serif">Serif (traditional)</option>
                    <option value="mono">Monospace (typewriter)</option>
                  </select>
                </div>
                <div class="field">
                  <label for="psize">Text size</label>
                  <select id="psize" class="select" [ngModel]="o().font_size" (ngModelChange)="set('font_size', $event)">
                    <option value="compact">Compact (fits more lines)</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div class="field">
                  <label for="ppaper">Paper size</label>
                  <select id="ppaper" class="select" [ngModel]="o().paper" (ngModelChange)="set('paper', $event)">
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="A5">A5 (half page)</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3>Logo</h3>
              <div class="upload">
                <div class="upload__box">
                  @if (o().logo) { <img [src]="o().logo" alt="Logo" /> } @else { <span class="muted small">No logo</span> }
                </div>
                <div class="upload__actions">
                  <label class="btn btn--outline btn--sm">
                    {{ o().logo ? 'Change logo' : 'Upload logo' }}
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="upload($event, 'logo')" />
                  </label>
                  @if (o().logo) { <button type="button" class="btn btn--ghost btn--sm" (click)="set('logo', null)">Remove</button> }
                  <small class="muted">PNG with a transparent background looks best. Resized automatically.</small>
                </div>
              </div>
              <div class="form-grid mt-2">
                <div class="field">
                  <label>Position</label>
                  <div class="seg">
                    @for (p of positions; track p[0]) {
                      <button type="button" [class.is-on]="o().logo_position === p[0]" (click)="set('logo_position', p[0])">{{ p[1] }}</button>
                    }
                  </div>
                </div>
                <div class="field">
                  <label>Size</label>
                  <div class="seg">
                    @for (s of sizes; track s[0]) {
                      <button type="button" [class.is-on]="o().logo_size === s[0]" (click)="set('logo_size', s[0])">{{ s[1] }}</button>
                    }
                  </div>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3>Header</h3>
              <div class="form-grid">
                <div class="field span-all">
                  <label for="ptag">Tagline under business name</label>
                  <input id="ptag" class="input" maxlength="200" [ngModel]="o().header_text" (ngModelChange)="set('header_text', $event)" placeholder="Wholesale dealers in stationery & office supplies" />
                </div>
                <div class="field">
                  <label for="pti">Invoice title</label>
                  <input id="pti" class="input" maxlength="40" [ngModel]="o().title_invoice" (ngModelChange)="set('title_invoice', $event)" placeholder="TAX INVOICE" />
                </div>
                <div class="field">
                  <label for="pte">Estimate title</label>
                  <input id="pte" class="input" maxlength="40" [ngModel]="o().title_estimate" (ngModelChange)="set('title_estimate', $event)" placeholder="ESTIMATE (e.g. QUOTATION)" />
                </div>
              </div>
              <div class="checks mt-2">
                @for (f of headerFlags; track f[0]) {
                  <label class="checkbox"><input type="checkbox" [ngModel]="o()[f[0]]" (ngModelChange)="set(f[0], $event)" /> {{ f[1] }}</label>
                }
              </div>
            </div>

            <div class="form-section">
              <h3>Items & totals</h3>
              <div class="checks">
                @for (f of bodyFlags; track f[0]) {
                  <label class="checkbox"><input type="checkbox" [ngModel]="o()[f[0]]" (ngModelChange)="set(f[0], $event)" /> {{ f[1] }}</label>
                }
              </div>
            </div>

            <div class="form-section">
              <h3>Footer & signature</h3>
              <div class="field">
                <label for="pf">Footer text (left of the signature)</label>
                <textarea id="pf" class="textarea" rows="3" maxlength="1000" [ngModel]="footer()" (ngModelChange)="footer.set($event)"
                  placeholder="Bank: HDFC Bank · A/c No 50100123456789 · IFSC HDFC0001234&#10;UPI: business@okhdfc"></textarea>
                <small class="muted">Bank details, UPI ID, a thank-you line or a declaration.</small>
              </div>
              <div class="field mt-2">
                <label for="pfn">Bottom line (centred, small)</label>
                <input id="pfn" class="input" maxlength="200" [ngModel]="o().footer_note" (ngModelChange)="set('footer_note', $event)" placeholder="This is a computer generated invoice" />
              </div>
              <label class="checkbox mt-2"><input type="checkbox" [ngModel]="o().show_signature" (ngModelChange)="set('show_signature', $event)" /> Show signature box</label>
              @if (o().show_signature) {
                <div class="form-grid mt-2">
                  <div class="field">
                    <label for="psl">Signatory label</label>
                    <input id="psl" class="input" maxlength="60" [ngModel]="o().signatory_label" (ngModelChange)="set('signatory_label', $event)" placeholder="Authorised signatory" />
                  </div>
                </div>
                <div class="upload mt-2">
                  <div class="upload__box upload__box--sign">
                    @if (o().signature) { <img [src]="o().signature" alt="Signature" /> } @else { <span class="muted small">No signature / stamp</span> }
                  </div>
                  <div class="upload__actions">
                    <label class="btn btn--outline btn--sm">
                      {{ o().signature ? 'Change signature' : 'Upload signature / stamp' }}
                      <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="upload($event, 'signature')" />
                    </label>
                    @if (o().signature) { <button type="button" class="btn btn--ghost btn--sm" (click)="set('signature', null)">Remove</button> }
                  </div>
                </div>
              }
            </div>
          </fieldset>
        </div>
        @if (auth.isAdmin()) {
          <div class="card__footer form-actions">
            <button type="button" class="btn btn--ghost" (click)="reset()">Reset to defaults</button>
            <button type="button" class="btn" [disabled]="saving()" (click)="save()">Save PDF settings</button>
          </div>
        }
      </div>

      <aside class="preview">
        <div class="preview__bar">
          <strong>Live preview</strong>
          <div class="seg seg--sm">
            <button type="button" [class.is-on]="sampleType() === 'invoice'" (click)="sampleType.set('invoice')">Invoice</button>
            <button type="button" [class.is-on]="sampleType() === 'estimate'" (click)="sampleType.set('estimate')">Estimate</button>
          </div>
        </div>
        <div class="preview__paper">
          <app-document-sheet [doc]="sample()" [org]="previewOrg()" [template]="template()" [accent]="accent()" [options]="o()" [footer]="footer()" />
        </div>
        <small class="muted">Sample data. Your real documents use these settings when you press PDF / Print.</small>
      </aside>
    </div>
  `,
})
export class PdfSettings implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly templates = PDF_TEMPLATES;
  protected readonly accents = PDF_ACCENTS;
  protected readonly positions: [PdfOptions['logo_position'], string][] = [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']];
  protected readonly sizes: [PdfOptions['logo_size'], string][] = [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']];
  protected readonly headerFlags: [Flag, string][] = [
    ['show_org_name', 'Business name'],
    ['show_org_address', 'Address'],
    ['show_org_gstin', taxProfile(this.auth.organization()).idLabel],
    ['show_org_phone', 'Phone'],
    ['show_org_email', 'Email'],
    ['show_customer_gstin', `Customer's ${taxProfile(this.auth.organization()).idLabel}`],
  ];
  protected readonly bodyFlags: [Flag, string][] = [
    ['show_item_description', 'Item descriptions'],
    ['show_discount_column', 'Discount column'],
    ['show_tax_column', 'Tax % column'],
    ['show_amount_words', 'Amount in words'],
    ['show_balance', 'Payments & balance due'],
    ['show_notes', 'Customer notes'],
    ['show_terms', 'Terms & conditions'],
    ['show_paid_stamp', 'PAID stamp on paid invoices'],
  ];

  protected readonly template = signal<PdfTemplateId>(orgPdfTemplate(this.auth.organization()));
  protected readonly accent = signal(orgPdfAccent(this.auth.organization()));
  protected readonly footer = signal(this.auth.organization()?.pdf_footer ?? '');
  protected readonly o = signal<PdfOptions>(orgPdfOptions(this.auth.organization()));
  protected readonly saving = signal(false);
  protected readonly sampleType = signal<'invoice' | 'estimate'>('invoice');
  private readonly org = signal<Organization | null>(this.auth.organization());

  protected readonly previewOrg = computed(() => this.org());
  protected readonly sample = computed<Document>(() =>
    this.sampleType() === 'invoice'
      ? SAMPLE
      : { ...SAMPLE, type: 'estimate', number: 'EST-00017', amount_paid: 0, balance: SAMPLE.total, reference: null },
  );

  ngOnInit(): void {
    this.api.get<Organization>('organization').subscribe((o) => {
      this.org.set(o);
      this.template.set(orgPdfTemplate(o));
      this.accent.set(orgPdfAccent(o));
      this.footer.set(o.pdf_footer ?? '');
      this.o.set(orgPdfOptions(o));
    });
  }

  protected set<K extends keyof PdfOptions>(key: K, value: PdfOptions[K]): void {
    this.o.update((o) => ({ ...o, [key]: value }));
  }

  protected async upload(e: Event, key: 'logo' | 'signature'): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.set(key, key === 'logo' ? await resizeImage(file, 600, 240) : await resizeImage(file, 500, 160));
    } catch (err) {
      this.toast.error((err as Error).message);
    }
  }

  protected reset(): void {
    this.template.set('classic');
    this.accent.set(PDF_ACCENTS[0]);
    // Keep uploaded images and texts; reset layout switches only.
    this.o.update((o) => ({ ...DEFAULT_PDF_OPTIONS, logo: o.logo, signature: o.signature, header_text: o.header_text, footer_note: o.footer_note }));
  }

  save(): void {
    const org = this.org();
    if (!org) return;
    this.saving.set(true);
    // The organization endpoint expects the full profile, so send it back with the PDF fields changed.
    const body = { ...org, pdf_template: this.template(), pdf_accent: this.accent(), pdf_footer: this.footer() || null, pdf_options: this.o() };
    this.api.put<Organization>('organization', body).subscribe({
      next: (o) => {
        this.org.set(o);
        this.auth.setOrganization(o);
        this.saving.set(false);
        if (o.pdf_options === undefined) {
          this.toast.error('Saved, but the database needs the PDF upgrade first (deploy/sql/upgrade-2026-11-pdf-templates.sql).');
        } else {
          this.toast.success('PDF settings saved');
        }
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
