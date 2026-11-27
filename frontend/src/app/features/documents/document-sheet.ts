import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Document, Organization, PdfOptions, PdfTemplateId } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { DOC_CONFIG } from '../../core/documents.config';
import { amountInWords, ARABIC_LABELS, ARABIC_TITLES, DEFAULT_PDF_OPTIONS, PDF_FONTS } from '../../core/pdf-templates';
import { taxProfile } from '../../core/tax-regime';
import { calculateTotals } from '../../core/utils/totals';
import { MoneyPipe } from '../../shared/money.pipe';

/** The printable document (invoice, estimate, bill…). Used by the document page and the live preview in Settings → PDF templates. */
@Component({
  selector: 'app-document-sheet',
  imports: [DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './document-sheet.scss',
  template: `
    @let d = doc();
    @let o = options();
    @let a = ar();
    <article
      class="card sheet"
      [class]="'tpl-' + template() + ' fs-' + o.font_size"
      [style.--accent]="accent()"
      [style.--pdf-font]="font()"
      [attr.data-type]="d.type"
    >
      <div class="deco" aria-hidden="true"></div>
      @if (d.status === 'paid' && o.show_paid_stamp) { <div class="ribbon">PAID</div> }
      @if (o.logo && o.logo_position === 'center') {
        <div class="logo-top"><img [src]="o.logo" alt="" [class]="'logo logo--' + o.logo_size" /></div>
      }
      <header class="sheet__head">
        <div class="brand" [class.brand--center]="o.logo_position === 'center'">
          @if (o.logo && o.logo_position === 'left') { <img [src]="o.logo" alt="" [class]="'logo logo--' + o.logo_size" /> }
          <div>
            @if (o.show_org_name) { <div class="org-name">{{ org()?.name }}</div> }
            @if (o.header_text) { <div class="tagline">{{ o.header_text }}</div> }
            <div class="muted small org-meta">
              @if (o.show_org_address) {
                @if (org()?.address) { {{ org()?.address }}<br /> }
                @if (orgCity()) { {{ orgCity() }}<br /> }
              }
              @if (o.show_org_gstin && org()?.gstin) { {{ tax().idLabel }}@if (a) { <span class="ar ar--inline">{{ a.trn }}</span> }: {{ org()?.gstin }}<br /> }
              @if (o.show_org_phone && org()?.phone) { {{ org()?.phone }}<br /> }
              @if (o.show_org_email && org()?.email) { {{ org()?.email }} }
            </div>
          </div>
        </div>
        <div class="text-right">
          @if (o.logo && o.logo_position === 'right') { <img [src]="o.logo" alt="" [class]="'logo logo--right logo--' + o.logo_size" /> }
          <div class="doc-title">{{ title() }}</div>
          @if (a) { <div class="doc-title-ar ar" lang="ar" dir="rtl">{{ arTitle() }}</div> }
          <div class="muted doc-no"># {{ d.number }}</div>
          @if (cfg().payable && o.show_balance) {
            <div class="due-box">
              <small>Balance due@if (a) { <span class="ar">{{ a.balance }}</span> }</small>
              <strong>{{ d.balance | money }}</strong>
            </div>
          }
        </div>
      </header>

      <section class="sheet__meta">
        <div>
          <small class="muted label">{{ cfg().contactType === 'customer' ? 'Bill to' : 'Vendor' }}@if (a) { <span class="ar">{{ cfg().contactType === 'customer' ? a.billTo : a.vendor }}</span> }</small>
          @if (d.contact; as c) {
            <div class="strong">{{ c.name }}</div>
            <div class="muted small">
              @if (c.company_name) { {{ c.company_name }}<br /> }
              @if (c.billing_address) { <span style="white-space:pre-line">{{ c.billing_address }}</span><br /> }
              @if (c.gstin && o.show_customer_gstin) { {{ tax().idLabel }}@if (a) { <span class="ar ar--inline">{{ a.trn }}</span> }: {{ c.gstin }} }
            </div>
          }
        </div>
        <dl class="dl">
          @if (a) { <dt>{{ cfg().label }} no.<span class="ar">{{ a.number }}</span></dt><dd>{{ d.number }}</dd> }
          <dt>{{ cfg().label }} date@if (a) { <span class="ar">{{ a.date }}</span> }</dt><dd>{{ d.date | date: 'dd MMM yyyy' }}</dd>
          @if (d.payment_terms) { <dt>Terms@if (a) { <span class="ar">{{ a.terms }}</span> }</dt><dd>{{ d.payment_terms }}</dd> }
          @if (d.due_date) { <dt>{{ cfg().dueLabel }}@if (a) { <span class="ar">{{ cfg().payable ? a.due : a.validTill }}</span> }</dt><dd>{{ d.due_date | date: 'dd MMM yyyy' }}</dd> }
          @if (d.reference) { <dt>Reference@if (a) { <span class="ar">{{ a.reference }}</span> }</dt><dd>{{ d.reference }}</dd> }
        </dl>
      </section>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ o.show_item_description ? 'Item & description' : 'Item' }}@if (a) { <span class="ar">{{ a.item }}</span> }</th>
              <th class="text-right">Qty@if (a) { <span class="ar">{{ a.qty }}</span> }</th>
              <th class="text-right">Rate@if (a) { <span class="ar">{{ a.rate }}</span> }</th>
              @if (o.show_discount_column) { <th class="text-right">Disc@if (a) { <span class="ar">{{ a.discount }}</span> }</th> }
              @if (o.show_tax_column) { <th class="text-right">{{ tax().tax }}@if (a) { <span class="ar">{{ a.tax }}</span> }</th> }
              <th class="text-right">Amount@if (a) { <span class="ar">{{ a.amount }}</span> }</th>
            </tr>
          </thead>
          <tbody>
            @for (l of d.items; track $index) {
              <tr>
                <td class="muted">{{ $index + 1 }}</td>
                <td><strong>{{ l.name }}</strong>@if (l.description && o.show_item_description) { <span class="sub">{{ l.description }}</span> }</td>
                <td class="text-right mono">{{ l.quantity }} {{ l.unit }}</td>
                <td class="text-right mono">{{ l.rate | money: false }}</td>
                @if (o.show_discount_column) { <td class="text-right mono">{{ l.discount_percent ? l.discount_percent + '%' : '—' }}</td> }
                @if (o.show_tax_column) { <td class="text-right mono">{{ l.tax_rate ? l.tax_rate + '%' : '—' }}</td> }
                <td class="text-right mono">{{ l.amount | money: false }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <section class="sheet__foot">
        <div class="notes">
          @if (o.show_amount_words) {
            <div class="words">
              <small class="muted">Amount in words@if (a) { <span class="ar">{{ a.words }}</span> }</small>
              <div class="strong">{{ words() }}</div>
            </div>
          }
          @if (d.notes && o.show_notes) { <h4>Notes@if (a) { <span class="ar">{{ a.notes }}</span> }</h4><p class="muted">{{ d.notes }}</p> }
          @if (d.terms && o.show_terms) { <h4 class="mt-2">Terms & conditions@if (a) { <span class="ar">{{ a.tnc }}</span> }</h4><p class="muted small">{{ d.terms }}</p> }
        </div>
        <div class="sum">
          <div class="row"><span>Sub total@if (a) { <span class="ar">{{ a.subtotal }}</span> }</span><span class="mono">{{ d.subtotal | money }}</span></div>
          @for (t of breakup(); track t.rate) {
            @if (halfTax()) {
              <div class="row muted"><span>CGST &#64; {{ t.rate / 2 }}%</span><span class="mono">{{ t.amount / 2 | money }}</span></div>
              <div class="row muted"><span>SGST &#64; {{ t.rate / 2 }}%</span><span class="mono">{{ t.amount / 2 | money }}</span></div>
            } @else {
              <div class="row muted"><span>{{ tax().tax }} &#64; {{ t.rate }}%@if (a) { <span class="ar">{{ a.tax }}</span> }</span><span class="mono">{{ t.amount | money }}</span></div>
            }
          }
          @if (d.discount) { <div class="row"><span>Discount@if (a) { <span class="ar">{{ a.discount }}</span> }</span><span class="mono">−{{ d.discount | money }}</span></div> }
          @if (d.adjustment) { <div class="row"><span>Adjustment@if (a) { <span class="ar">{{ a.adjustment }}</span> }</span><span class="mono">{{ d.adjustment | money }}</span></div> }
          <div class="row total"><span>Total@if (a) { <span class="ar">{{ a.total }}</span> }</span><span class="mono">{{ d.total | money }}</span></div>
          @if (cfg().payable && o.show_balance) {
            <div class="row"><span>Payments@if (a) { <span class="ar">{{ a.payments }}</span> }</span><span class="mono">−{{ d.amount_paid | money }}</span></div>
            <div class="row strong balance"><span>Balance due@if (a) { <span class="ar">{{ a.balance }}</span> }</span><span class="mono">{{ d.balance | money }}</span></div>
          }
        </div>
      </section>

      @if (footer() || o.show_signature) {
        <section class="sheet__sign">
          @if (footer()) { <div class="pdf-footer small">{{ footer() }}</div> } @else { <div></div> }
          @if (o.show_signature) {
            <div class="sign">
              <div class="sign__for">For {{ org()?.name }}</div>
              @if (o.signature) { <img class="sign__img" [src]="o.signature" alt="" /> } @else { <div class="sign__space"></div> }
              <div class="sign__line">{{ o.signatory_label || 'Authorised signatory' }}@if (a) { <span class="ar">{{ a.signatory }}</span> }</div>
            </div>
          }
        </section>
      }
      @if (o.footer_note) { <div class="footer-note">{{ o.footer_note }}</div> }
    </article>
  `,
})
export class DocumentSheet {
  private readonly auth = inject(AuthStore, { optional: true });

  readonly doc = input.required<Document>();
  readonly org = input<Organization | null>(null);
  readonly template = input<PdfTemplateId>('classic');
  readonly accent = input('#4f46e5');
  readonly options = input<PdfOptions>(DEFAULT_PDF_OPTIONS);
  /** Footer text (bank details etc.); kept as its own organization field. */
  readonly footer = input<string | null | undefined>(null);

  protected readonly cfg = computed(() => DOC_CONFIG[this.doc().type]);
  protected readonly tax = computed(() => taxProfile(this.org()));
  protected readonly font = computed(() => PDF_FONTS[this.options().font] ?? 'inherit');
  protected readonly orgCity = computed(() => {
    const o = this.org();
    return [o?.city, o?.state, o?.pincode].filter((v) => !!v).join(', ');
  });
  protected readonly title = computed(() => {
    const d = this.doc();
    const o = this.options();
    if (d.type === 'invoice') return o.title_invoice.trim() || (this.org()?.gstin ? this.tax().taxInvoiceTitle : 'INVOICE');
    if (d.type === 'credit_note' && this.org()?.gstin && this.tax().regime === 'vat') return 'TAX CREDIT NOTE';
    if (d.type === 'estimate' && o.title_estimate.trim()) return o.title_estimate.trim();
    return this.cfg().label.toUpperCase();
  });
  /** Intra-state GST shows CGST + SGST split. */
  protected readonly halfTax = computed(() => {
    const o = this.org();
    const c = this.doc().contact;
    return this.tax().splitCgstSgst && !!o?.gstin && (!c?.state || !o.state || c.state.toLowerCase() === o.state.toLowerCase());
  });
  /** Arabic labels shown beside the English ones (UAE bilingual template only). */
  protected readonly ar = computed(() => (this.template() === 'bilingual' ? ARABIC_LABELS : null));
  protected readonly arTitle = computed(() => {
    const d = this.doc();
    const registered = !!this.org()?.gstin && this.tax().regime !== 'none';
    if (d.type === 'invoice' && registered) return ARABIC_TITLES.tax_invoice;
    if (d.type === 'credit_note' && registered) return ARABIC_TITLES.tax_credit_note;
    return ARABIC_TITLES[d.type] ?? '';
  });
  protected readonly breakup = computed(() => calculateTotals(this.doc().items ?? []).taxBreakup);
  protected readonly words = computed(() => amountInWords(this.doc().total ?? 0, this.auth?.currency() ?? 'INR'));
}
