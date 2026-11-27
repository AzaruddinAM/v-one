import { Organization, PdfOptions, PdfTemplateId } from './api/models';

export interface PdfTemplate {
  id: PdfTemplateId;
  label: string;
  description: string;
}

/** Layouts for printed / PDF invoices, estimates and other documents. Styles live in document-view.scss (`.tpl-<id>`). */
export const PDF_TEMPLATES: readonly PdfTemplate[] = [
  { id: 'classic', label: 'Classic', description: 'Clean layout with a dark item table. The original v-one look.' },
  { id: 'modern', label: 'Modern', description: 'Colour header band with your accent colour and soft rows.' },
  { id: 'minimal', label: 'Minimal', description: 'Black and white, thin lines, lots of white space. Ink friendly.' },
  { id: 'gst', label: 'GST Tax Invoice', description: 'Boxed Indian tax-invoice format with bordered cells and signature box.' },
];

export const PDF_ACCENTS: readonly string[] = ['#4f46e5', '#2563eb', '#0f766e', '#15803d', '#b45309', '#be123c', '#7c3aed', '#1e293b'];

export const DEFAULT_PDF_TEMPLATE: PdfTemplateId = 'classic';
export const DEFAULT_PDF_ACCENT = '#4f46e5';

export function orgPdfTemplate(org: Organization | null | undefined): PdfTemplateId {
  const t = org?.pdf_template;
  return t && PDF_TEMPLATES.some((x) => x.id === t) ? t : DEFAULT_PDF_TEMPLATE;
}

export function orgPdfAccent(org: Organization | null | undefined): string {
  const a = org?.pdf_accent;
  return a && /^#[0-9a-f]{6}$/i.test(a) ? a : DEFAULT_PDF_ACCENT;
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  logo: null,
  logo_position: 'left',
  logo_size: 'm',
  show_org_name: true,
  header_text: '',
  show_org_address: true,
  show_org_gstin: true,
  show_org_phone: true,
  show_org_email: false,
  title_invoice: '',
  title_estimate: '',
  show_customer_gstin: true,
  show_item_description: true,
  show_discount_column: true,
  show_tax_column: true,
  show_amount_words: true,
  show_notes: true,
  show_terms: true,
  show_balance: true,
  show_paid_stamp: true,
  show_signature: true,
  signature: null,
  signatory_label: 'Authorised signatory',
  footer_note: '',
  font: 'sans',
  font_size: 'normal',
  paper: 'A4',
};

/** Organization options merged over the defaults; unknown or wrongly typed values fall back to the default. */
export function orgPdfOptions(org: Organization | null | undefined): PdfOptions {
  const saved = (org?.pdf_options ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PDF_OPTIONS } as Record<string, unknown>;
  for (const [key, def] of Object.entries(DEFAULT_PDF_OPTIONS)) {
    const v = saved[key];
    if (v === undefined) continue;
    if (def === null ? v === null || typeof v === 'string' : typeof v === typeof def) out[key] = v;
  }
  return out as unknown as PdfOptions;
}

export const PAPER_SIZES: Record<PdfOptions['paper'], string> = { A4: 'A4', Letter: 'Letter', A5: 'A5' };

export const PDF_FONTS: Record<PdfOptions['font'], string> = {
  sans: 'inherit',
  serif: "Georgia, Cambria, 'Times New Roman', serif",
  mono: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0–999 in words. */
function hundreds(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** Whole number in words: Indian system (lakh, crore) or international (million, billion). */
export function numberToWords(value: number, indian = true): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const scales: [number, string][] = indian
    ? [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1_000, 'Thousand']]
    : [[1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1_000, 'Thousand']];
  const parts: string[] = [];
  for (const [size, name] of scales) {
    if (n >= size) {
      const q = Math.floor(n / size);
      // Crores can exceed 999 (e.g. 1,234 crore); spell those recursively.
      parts.push(`${q > 999 ? numberToWords(q, indian) : hundreds(q)} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(hundreds(n));
  return parts.join(' ');
}

const CURRENCY_WORDS: Record<string, [string, string]> = {
  INR: ['Rupees', 'Paise'],
  USD: ['Dollars', 'Cents'],
  EUR: ['Euros', 'Cents'],
  GBP: ['Pounds', 'Pence'],
  AUD: ['Dollars', 'Cents'],
  CAD: ['Dollars', 'Cents'],
  SGD: ['Dollars', 'Cents'],
  AED: ['Dirhams', 'Fils'],
  SAR: ['Riyals', 'Halalas'],
  QAR: ['Riyals', 'Dirhams'],
};

/** "Rupees One Thousand Two Hundred Fifty and Fifty Paise Only" */
export function amountInWords(amount: number, currency = 'INR'): string {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  const whole = Math.floor(value / 100);
  const fraction = value % 100;
  const [major, minor] = CURRENCY_WORDS[currency] ?? [currency, 'Cents'];
  const indian = currency === 'INR';
  let text = `${major} ${numberToWords(whole, indian)}`;
  if (fraction) text += ` and ${numberToWords(fraction)} ${minor}`;
  return `${text} Only`;
}
