export type Role = 'admin' | 'accountant' | 'staff';

export interface Organization {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  industry?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  tax_regime?: TaxRegime | null;
  currency: string;
  currency_symbol: string;
  fiscal_year_start: number;
  date_format?: string | null;
  invoice_terms?: string | null;
  invoice_notes?: string | null;
  pdf_template?: PdfTemplateId | null;
  pdf_accent?: string | null;
  pdf_footer?: string | null;
  pdf_options?: Partial<PdfOptions> | null;
  /** Custom numbering per document type. Empty prefix = default style (INV-00001). */
  number_series?: Partial<Record<DocumentType, NumberSeries>> | null;
  /** Payment reminder message with {customer} {invoice} {amount} {due_date} {days} {org} placeholders. */
  reminder_template?: string | null;
}

export type TaxRegime = 'gst' | 'vat' | 'none';

export interface NumberSeries {
  /** e.g. "INV-{YY}-{CODE}-"; placeholders {YYYY} {YY} {MM} {FY} {CODE}. */
  prefix: string;
  next: number;
  digits: number;
}

export type PdfTemplateId = 'classic' | 'modern' | 'minimal' | 'gst';

/** Extra customisation for printed / PDF documents, stored as JSON on the organization. */
export interface PdfOptions {
  /** Logo as a data URL (PNG / JPEG / WEBP), resized in the browser before upload. */
  logo: string | null;
  logo_position: 'left' | 'right' | 'center';
  logo_size: 's' | 'm' | 'l';
  show_org_name: boolean;
  /** Tagline / extra line printed under the business name. */
  header_text: string;
  show_org_address: boolean;
  show_org_gstin: boolean;
  show_org_phone: boolean;
  show_org_email: boolean;
  /** Custom titles, e.g. "QUOTATION" instead of "ESTIMATE". Empty = default. */
  title_invoice: string;
  title_estimate: string;
  show_customer_gstin: boolean;
  show_item_description: boolean;
  show_discount_column: boolean;
  show_tax_column: boolean;
  show_amount_words: boolean;
  show_notes: boolean;
  show_terms: boolean;
  show_balance: boolean;
  show_paid_stamp: boolean;
  show_signature: boolean;
  /** Signature / stamp image as a data URL. */
  signature: string | null;
  signatory_label: string;
  /** Small centred line at the very bottom, e.g. "This is a computer generated invoice". */
  footer_note: string;
  font: 'sans' | 'serif' | 'mono';
  font_size: 'compact' | 'normal' | 'large';
  paper: 'A4' | 'Letter' | 'A5';
}

export interface User {
  id: number;
  organization_id: number;
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
  is_active: boolean;
  last_login_at?: string | null;
  organization?: Organization;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Tax {
  id: number;
  name: string;
  rate: number;
  type?: string;
  is_active?: boolean;
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  sub_type?: string | null;
  description?: string | null;
  opening_balance?: number;
  is_system?: boolean;
  is_active?: boolean;
}

export type ContactType = 'customer' | 'vendor';

export interface Contact {
  id: number;
  type: ContactType;
  name: string;
  company_name?: string | null;
  /** Short code used by {CODE} in invoice numbers, e.g. "TU". */
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  opening_balance?: number;
  payment_terms?: number;
  notes?: string | null;
  is_active?: boolean;
  outstanding?: number | null;
}

export interface ContactDetail extends Contact {
  summary: { outstanding: number; total_billed: number; total_paid: number };
  recent_documents: DocumentSummary[];
}

export interface Item {
  id: number;
  name: string;
  sku?: string | null;
  type: 'goods' | 'service';
  unit?: string | null;
  hsn_code?: string | null;
  category?: string | null;
  description?: string | null;
  sales_price: number;
  purchase_price?: number;
  tax_id?: number | null;
  tax?: Pick<Tax, 'id' | 'name' | 'rate'> | null;
  track_inventory?: boolean;
  stock_on_hand?: number;
  reorder_level?: number;
  is_active?: boolean;
}

export type DocumentType =
  | 'estimate'
  | 'sales_order'
  | 'delivery_challan'
  | 'invoice'
  | 'credit_note'
  | 'purchase_order'
  | 'bill'
  | 'vendor_credit';

export interface DocumentLine {
  id?: number;
  item_id?: number | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  rate: number;
  discount_percent?: number;
  tax_id?: number | null;
  tax_rate?: number;
  tax_amount?: number;
  amount?: number;
}

export interface DocumentSummary {
  id: number;
  type: DocumentType;
  number: string;
  date: string;
  due_date?: string | null;
  total: number;
  balance: number;
  status: string;
  contact_id?: number;
  contact?: Pick<Contact, 'id' | 'name' | 'company_name'>;
}

export interface Document extends DocumentSummary {
  reference?: string | null;
  contact_id: number;
  payment_terms?: string | null;
  recurring_profile_id?: number | null;
  reminded_at?: string | null;
  reminder_count?: number;
  subtotal: number;
  discount: number;
  tax_total: number;
  adjustment: number;
  amount_paid: number;
  notes?: string | null;
  terms?: string | null;
  converted_from_id?: number | null;
  converted_from?: { id: number; type: DocumentType; number: string } | null;
  contact?: Contact;
  items?: DocumentLine[];
  payments?: Payment[];
}

export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' | 'other';

export interface Payment {
  id: number;
  direction: 'in' | 'out';
  number: string;
  contact_id: number;
  document_id?: number | null;
  account_id?: number | null;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference?: string | null;
  notes?: string | null;
  contact?: Pick<Contact, 'id' | 'name'>;
  document?: Pick<Document, 'id' | 'type' | 'number'> | null;
  account?: Pick<Account, 'id' | 'name'> | null;
}

export interface Expense {
  id: number;
  date: string;
  account_id: number;
  paid_through_id?: number | null;
  contact_id?: number | null;
  amount: number;
  tax_id?: number | null;
  tax_amount: number;
  total: number;
  reference?: string | null;
  description?: string | null;
  account?: Pick<Account, 'id' | 'name'>;
  paid_through?: Pick<Account, 'id' | 'name'> | null;
  contact?: Pick<Contact, 'id' | 'name'> | null;
}

export interface JournalLine {
  account_id: number;
  description?: string | null;
  debit: number;
  credit: number;
  account?: Pick<Account, 'id' | 'code' | 'name'>;
}

export interface Journal {
  id: number;
  number: string;
  date: string;
  reference?: string | null;
  notes?: string | null;
  total: number;
  lines_count?: number;
  lines?: JournalLine[];
}

export interface Lookups {
  taxes: Tax[];
  accounts: Account[];
  payment_modes: PaymentMode[];
  units: string[];
  statuses: Record<DocumentType, string[]>;
  payment_terms?: string[];
  tax_regime?: TaxRegime;
}

export type RecurringType = 'invoice' | 'bill';
export type RecurringFrequency = 'week' | 'month' | 'year';

export interface RecurringProfile {
  id: number;
  type: RecurringType;
  name: string;
  contact_id: number;
  contact?: Contact;
  frequency: RecurringFrequency;
  interval: number;
  start_date: string;
  end_date?: string | null;
  next_date: string;
  status: 'active' | 'paused' | 'expired';
  auto_send: boolean;
  payment_terms?: string | null;
  template: {
    reference?: string | null;
    discount?: number;
    adjustment?: number;
    notes?: string | null;
    terms?: string | null;
    items: DocumentLine[];
  };
  generated_count: number;
  last_generated_at?: string | null;
  documents?: DocumentSummary[];
}

export interface OverdueInvoice extends DocumentSummary {
  reminded_at?: string | null;
  reminder_count: number;
  days_overdue: number;
  contact: Pick<Contact, 'id' | 'name' | 'company_name' | 'email' | 'phone'>;
}

export interface Dashboard {
  receivable: number;
  payable: number;
  overdue_receivable: number;
  overdue_payable: number;
  sales_this_month: number;
  expenses_this_month: number;
  received_this_month: number;
  counts: { customers: number; vendors: number; items: number; unpaid_invoices: number };
  trend: { month: string; sales: number; expenses: number }[];
  top_customers: { id: number; name: string; total: number }[];
  recent: DocumentSummary[];
  low_stock: Pick<Item, 'id' | 'name' | 'sku' | 'stock_on_hand' | 'reorder_level' | 'unit'>[];
}

export interface ReportLine {
  name: string;
  amount: number;
}
