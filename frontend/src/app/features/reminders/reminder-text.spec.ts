import { OverdueInvoice } from '../../core/api/models';
import { mailtoLink, reminderText, whatsappLink } from './reminder-text';

const inv = (number: string, balance: number, days: number, due: string): OverdueInvoice =>
  ({ id: 1, type: 'invoice', number, date: '2026-08-01', due_date: due, total: balance, balance, status: 'overdue', contact_id: 7, reminder_count: 0, days_overdue: days, contact: { id: 7, name: 'Ravi', company_name: 'Design Infinity LLC', email: 'a@b.c', phone: '+971 50 123 4567' } }) as OverdueInvoice;

describe('payment reminders', () => {
  it('fills the default template', () => {
    const t = reminderText('', [inv('INV-26-DI-2627', 4588.5, 197, '2026-05-14')], 'Sapphire Lights', 'AED');
    expect(t).toContain('Dear Design Infinity LLC');
    expect(t).toContain('invoice INV-26-DI-2627 for AED');
    expect(t).toContain('4,588.50');
    expect(t).toContain('14 May 2026');
    expect(t).toContain('197 days overdue');
    expect(t).toContain('Sapphire Lights');
  });

  it('lists several invoices and uses a custom template', () => {
    const t = reminderText('Hi {customer}, {invoice} total {amount} ({days}d)', [inv('A', 100, 5, '2026-11-01'), inv('B', 50, 12, '2026-10-20')], 'X', 'AED');
    expect(t.replace(/\s/g, ' ')).toBe('Hi Design Infinity LLC, A, B total AED 150.00 (12d)');
  });

  it('builds links', () => {
    expect(whatsappLink('+971 50 123 4567', 'hi there')).toBe('https://wa.me/971501234567?text=hi%20there');
    expect(mailtoLink('a@b.c', 'S', 'x y')).toBe('mailto:a%40b.c?subject=S&body=x%20y');
  });
});
