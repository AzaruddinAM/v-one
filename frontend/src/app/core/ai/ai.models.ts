import { Document, Expense } from '../api/models';

export interface AiStatus {
  enabled: boolean;
  model: string;
}

export interface BillPreviewLine {
  item_id: number | null;
  matched_name?: string | null;
  name: string;
  description?: string | null;
  hsn_code?: string | null;
  quantity: number;
  unit?: string | null;
  rate: number;
  discount_percent: number;
  tax_rate?: number;
  tax_id: number | null;
  create_item: boolean;
}

export interface BillPreviewVendor {
  id: number | null;
  matched_name?: string | null;
  name: string;
  gstin?: string | null;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
  billing_address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

/** What Gemini read from the uploaded bill, matched with existing vendors / items / taxes. */
export interface BillPreview {
  target: 'bill' | 'expense';
  document_kind: string;
  confidence: number | null;
  warnings: string[];
  vendor: BillPreviewVendor;
  reference: string | null;
  date: string;
  due_date: string | null;
  discount: number;
  notes: string | null;
  items: BillPreviewLine[];
  extracted: { subtotal: number; tax_total: number; total: number | null; currency: string | null };
  expense: { account_id: number | null; amount: number; tax_id: number | null; description: string | null };
}

export interface BillImportResult {
  type: 'bill' | 'expense';
  record: Document | Expense;
  created: { vendor: boolean; items: number };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  /** What the user typed when `text` was expanded from a /command. */
  display?: string;
  error?: boolean;
  /** Shown in the chat only (help, navigation notes) — never sent to Gemini. */
  local?: boolean;
  at: number;
}

export interface ChatReply {
  reply: string;
  tools: string[];
}
