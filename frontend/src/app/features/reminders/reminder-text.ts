import { OverdueInvoice } from '../../core/api/models';
import { formatMoney } from '../../shared/money.pipe';

export const DEFAULT_REMINDER = `Dear {customer},

This is a friendly reminder that invoice {invoice} for {amount} was due on {due_date} and is now {days} days overdue.
Kindly arrange the payment at the earliest. Please ignore this message if you have already paid.

Thank you,
{org}`;

/** Fill a reminder template for one or more overdue invoices of the same customer. */
export function reminderText(template: string | null | undefined, invoices: OverdueInvoice[], orgName: string, currency: string): string {
  const first = invoices[0];
  const total = invoices.reduce((s, i) => s + Number(i.balance), 0);
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const invoiceList = invoices.length === 1 ? first.number : invoices.map((i) => i.number).join(', ');
  const values: Record<string, string> = {
    customer: first.contact.company_name || first.contact.name,
    invoice: invoiceList,
    amount: formatMoney(total, currency),
    due_date: invoices.length === 1 ? fmtDate(first.due_date!) : invoices.map((i) => fmtDate(i.due_date!)).join(', '),
    days: String(Math.max(...invoices.map((i) => i.days_overdue))),
    org: orgName,
  };
  return (template?.trim() || DEFAULT_REMINDER).replace(/\{(customer|invoice|amount|due_date|days|org)\}/g, (_, k: string) => values[k]);
}

/** wa.me link: digits only, with the country code (assumed already in the saved phone number). */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailtoLink(email: string | null | undefined, subject: string, text: string): string {
  return `mailto:${encodeURIComponent(email ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
