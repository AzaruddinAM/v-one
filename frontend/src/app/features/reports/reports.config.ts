export interface ReportDef {
  key: string;
  title: string;
  description: string;
  group: 'Business overview' | 'Sales' | 'Receivables & payables' | 'Accountant' | 'Tax & inventory';
  icon: string;
  period: 'range' | 'asOf' | 'none';
  /** Only listed for organizations on this tax system. */
  regime?: 'gst' | 'vat';
}

export const REPORTS: ReportDef[] = [
  { key: 'profit-loss', title: 'Profit & Loss', description: 'Income, expenses and net profit for a period.', group: 'Business overview', icon: 'trending-up', period: 'range' },
  { key: 'balance-sheet', title: 'Balance Sheet', description: 'Assets, liabilities and equity as of a date.', group: 'Business overview', icon: 'layers', period: 'asOf' },
  { key: 'sales-by-customer', title: 'Sales by Customer', description: 'Invoiced amounts grouped by customer.', group: 'Sales', icon: 'users', period: 'range' },
  { key: 'sales-by-item', title: 'Sales by Item', description: 'Quantities and revenue per item.', group: 'Sales', icon: 'box', period: 'range' },
  { key: 'receivables', title: 'Receivables Aging', description: 'Outstanding invoices grouped by days overdue.', group: 'Receivables & payables', icon: 'invoice', period: 'none' },
  { key: 'payables', title: 'Payables Aging', description: 'Unpaid bills grouped by days overdue.', group: 'Receivables & payables', icon: 'receipt', period: 'none' },
  { key: 'customer-balances', title: 'Customer Balances', description: 'What each customer owes, and advances they have paid.', group: 'Receivables & payables', icon: 'users', period: 'asOf' },
  { key: 'vendor-balances', title: 'Vendor Balances', description: 'What you owe each vendor.', group: 'Receivables & payables', icon: 'truck', period: 'asOf' },
  { key: 'trial-balance', title: 'Trial Balance', description: 'Debit and credit balance of every account; the two totals always agree.', group: 'Accountant', icon: 'scale', period: 'asOf' },
  { key: 'general-ledger', title: 'General Ledger', description: 'Every posting per account with opening, running and closing balance.', group: 'Accountant', icon: 'book', period: 'range' },
  { key: 'day-book', title: 'Day Book', description: 'All transactions of the period in date order, with their debit and credit lines.', group: 'Accountant', icon: 'journal', period: 'range' },
  { key: 'vat-return', title: 'VAT Return (VAT 201)', description: 'UAE VAT return boxes: standard, zero-rated and exempt supplies, recoverable VAT, net VAT due.', group: 'Tax & inventory', icon: 'percent', period: 'range', regime: 'vat' },
  { key: 'tax-summary', title: 'GST / Tax Summary', description: 'Output tax vs input tax credit and net payable.', group: 'Tax & inventory', icon: 'percent', period: 'range' },
  { key: 'inventory', title: 'Inventory Valuation', description: 'Stock on hand and its value at cost.', group: 'Tax & inventory', icon: 'box', period: 'none' },
];
