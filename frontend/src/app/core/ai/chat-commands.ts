/**
 * Slash commands for the v-one Assistant. "prompt" commands expand into a question for Gemini,
 * the others are handled in the browser (navigation, clearing the chat, scanning a bill).
 */
export interface ChatCommand {
  name: string;
  usage: string;
  description: string;
  example?: string;
}

export type CommandResult =
  | { kind: 'prompt'; text: string }
  | { kind: 'navigate'; url: string; label: string }
  | { kind: 'help' }
  | { kind: 'clear' }
  | { kind: 'scan' }
  | { kind: 'error'; text: string };

export const CHAT_COMMANDS: ChatCommand[] = [
  { name: 'help', usage: '/help', description: 'Show all commands' },
  { name: 'scan', usage: '/scan', description: 'Upload a bill photo / PDF — AI reads it, you review and confirm' },
  { name: 'summary', usage: '/summary', description: 'Business snapshot: sales, dues, payables, cash received' },
  { name: 'sales', usage: '/sales [period]', description: 'Sales for a period', example: '/sales last month' },
  { name: 'dues', usage: '/dues', description: 'Who owes me money (receivables aging)' },
  { name: 'overdue', usage: '/overdue', description: 'Overdue customer invoices' },
  { name: 'payables', usage: '/payables', description: 'What I owe vendors, unpaid bills' },
  { name: 'expenses', usage: '/expenses [period]', description: 'Expense breakdown by category', example: '/expenses this month' },
  { name: 'pl', usage: '/pl [period]', description: 'Profit & loss', example: '/pl this financial year' },
  { name: 'gst', usage: '/gst [period]', description: 'GST output, input and net payable', example: '/gst last quarter' },
  { name: 'stock', usage: '/stock [item]', description: 'Low stock alerts, or stock of one item', example: '/stock A4 paper' },
  { name: 'top', usage: '/top [period]', description: 'Top customers and best-selling items' },
  { name: 'find', usage: '/find <name or phone>', description: 'Look up a customer or vendor', example: '/find Sharma' },
  { name: 'doc', usage: '/doc <number>', description: 'Details of an invoice / bill / estimate', example: '/doc INV-00012' },
  { name: 'remind', usage: '/remind <customer>', description: 'Draft a polite payment reminder (WhatsApp + email)', example: '/remind Ravi Stores' },
  { name: 'new', usage: '/new <invoice|bill|estimate|order|customer|vendor|item|expense|journal>', description: 'Open a blank form', example: '/new invoice' },
  { name: 'go', usage: '/go <page>', description: 'Jump to a page (dashboard, invoices, bills, reports, settings…)', example: '/go reports' },
  { name: 'clear', usage: '/clear', description: 'Start a new conversation' },
];

const NEW_PAGES: Record<string, string> = {
  invoice: '/sales/invoices/new',
  estimate: '/sales/estimates/new',
  quote: '/sales/estimates/new',
  order: '/sales/orders/new',
  'sales-order': '/sales/orders/new',
  'credit-note': '/sales/credit-notes/new',
  po: '/purchases/orders/new',
  'purchase-order': '/purchases/orders/new',
  bill: '/purchases/bills/new',
  customer: '/customers/new',
  vendor: '/vendors/new',
  supplier: '/vendors/new',
  item: '/items/new',
  product: '/items/new',
  expense: '/expenses',
  journal: '/accounting/journals/new',
};

const GO_PAGES: Record<string, string> = {
  dashboard: '/dashboard',
  home: '/dashboard',
  customers: '/customers',
  vendors: '/vendors',
  suppliers: '/vendors',
  items: '/items',
  products: '/items',
  inventory: '/items',
  estimates: '/sales/estimates',
  quotes: '/sales/estimates',
  orders: '/sales/orders',
  invoices: '/sales/invoices',
  'credit-notes': '/sales/credit-notes',
  received: '/payments/received',
  'payments-received': '/payments/received',
  'purchase-orders': '/purchases/orders',
  bills: '/purchases/bills',
  scan: '/purchases/scan-bill',
  made: '/payments/made',
  'payments-made': '/payments/made',
  expenses: '/expenses',
  accounts: '/accounting/accounts',
  journals: '/accounting/journals',
  reports: '/reports',
  pl: '/reports/profit-loss',
  'profit-loss': '/reports/profit-loss',
  'balance-sheet': '/reports/balance-sheet',
  gst: '/reports/tax-summary',
  settings: '/settings',
  profile: '/settings/profile',
  taxes: '/settings/taxes',
  users: '/settings/users',
};

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-');

/** Turn what the user typed into an action. Plain text (no leading "/") is a normal question. */
export function parseCommand(input: string): CommandResult {
  const raw = input.trim();
  if (!raw.startsWith('/')) return { kind: 'prompt', text: raw };

  const [, cmd = '', rest = ''] = /^\/(\S*)\s*(.*)$/s.exec(raw) ?? [];
  const arg = rest.trim();
  const period = arg ? ` for ${arg}` : '';

  switch (cmd.toLowerCase()) {
    case 'help':
    case '?':
      return { kind: 'help' };
    case 'clear':
    case 'reset':
      return { kind: 'clear' };
    case 'scan':
    case 'upload':
      return { kind: 'scan' };
    case 'summary':
      return { kind: 'prompt', text: 'Give me a short business summary: receivables, overdue, payables, this month sales, expenses and money received, plus anything that needs my attention.' };
    case 'sales':
      return { kind: 'prompt', text: `What are my total sales${period || ' this month'}? Compare with the previous period if possible and list the top customers.` };
    case 'dues':
      return { kind: 'prompt', text: 'Who owes me money? Show customers with outstanding balances and how overdue they are (receivables aging).' };
    case 'overdue':
      return { kind: 'prompt', text: 'List my overdue customer invoices with customer, number, due date and balance, highest first.' };
    case 'payables':
      return { kind: 'prompt', text: 'What do I owe vendors? Show unpaid and overdue bills by vendor (payables aging).' };
    case 'expenses':
      return { kind: 'prompt', text: `Show my expenses${period || ' this month'} broken down by category.` };
    case 'pl':
    case 'profit':
      return { kind: 'prompt', text: `Show my profit & loss${period || ' for this financial year'} with income, expenses and net profit.` };
    case 'gst':
    case 'tax':
      return { kind: 'prompt', text: `Show my GST summary${period || ' for this month'}: output tax, input tax credit and net GST payable.` };
    case 'stock':
      return arg
        ? { kind: 'prompt', text: `What is the stock on hand and price of "${arg}"?` }
        : { kind: 'prompt', text: 'Which items are low on stock or below reorder level?' };
    case 'top':
      return { kind: 'prompt', text: `Who are my top customers and what are my best-selling items${period || ' this financial year'}?` };
    case 'find':
      return arg ? { kind: 'prompt', text: `Find the customer or vendor "${arg}" and show their contact details and outstanding balance.` } : { kind: 'error', text: 'Usage: /find <name or phone>' };
    case 'doc':
    case 'invoice':
    case 'bill':
      return arg ? { kind: 'prompt', text: `Show details of document ${arg}: contact, dates, lines, total, payments and balance.` } : { kind: 'error', text: 'Usage: /doc <number>, e.g. /doc INV-00012' };
    case 'remind':
      return arg
        ? { kind: 'prompt', text: `Look up the outstanding invoices of customer "${arg}" and draft a short, polite payment reminder as a WhatsApp message and as an email, mentioning invoice numbers, amounts and due dates.` }
        : { kind: 'error', text: 'Usage: /remind <customer name>' };
    case 'new': {
      const url = NEW_PAGES[key(arg)];
      return url ? { kind: 'navigate', url, label: `New ${arg}` } : { kind: 'error', text: `Usage: /new <${Object.keys(NEW_PAGES).slice(0, 10).join('|')}…>` };
    }
    case 'go':
    case 'open': {
      const url = GO_PAGES[key(arg)];
      return url ? { kind: 'navigate', url, label: arg } : { kind: 'error', text: `Unknown page "${arg}". Try: ${Object.keys(GO_PAGES).slice(0, 12).join(', ')}…` };
    }
    default:
      return { kind: 'error', text: `Unknown command /${cmd}. Type /help to see all commands.` };
  }
}

/** Commands whose name starts with what the user has typed so far (for the suggestion list). */
export function suggestCommands(input: string): ChatCommand[] {
  if (!input.startsWith('/') || input.includes(' ')) return [];
  const typed = input.slice(1).toLowerCase();
  return CHAT_COMMANDS.filter((c) => c.name.startsWith(typed));
}
