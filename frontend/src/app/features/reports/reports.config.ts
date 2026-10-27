export interface ReportDef {
  key: string;
  title: string;
  description: string;
  group: 'Business overview' | 'Sales' | 'Receivables & payables' | 'Tax & inventory';
  icon: string;
  period: 'range' | 'asOf' | 'none';
}

export const REPORTS: ReportDef[] = [
  { key: 'profit-loss', title: 'Profit & Loss', description: 'Income, expenses and net profit for a period.', group: 'Business overview', icon: 'trending-up', period: 'range' },
  { key: 'balance-sheet', title: 'Balance Sheet', description: 'Assets, liabilities and equity as of a date.', group: 'Business overview', icon: 'layers', period: 'asOf' },
  { key: 'sales-by-customer', title: 'Sales by Customer', description: 'Invoiced amounts grouped by customer.', group: 'Sales', icon: 'users', period: 'range' },
  { key: 'sales-by-item', title: 'Sales by Item', description: 'Quantities and revenue per item.', group: 'Sales', icon: 'box', period: 'range' },
  { key: 'receivables', title: 'Receivables Aging', description: 'Outstanding invoices grouped by days overdue.', group: 'Receivables & payables', icon: 'invoice', period: 'none' },
  { key: 'payables', title: 'Payables Aging', description: 'Unpaid bills grouped by days overdue.', group: 'Receivables & payables', icon: 'receipt', period: 'none' },
  { key: 'tax-summary', title: 'GST / Tax Summary', description: 'Output tax vs input tax credit and net payable.', group: 'Tax & inventory', icon: 'percent', period: 'range' },
  { key: 'inventory', title: 'Inventory Valuation', description: 'Stock on hand and its value at cost.', group: 'Tax & inventory', icon: 'box', period: 'none' },
];
