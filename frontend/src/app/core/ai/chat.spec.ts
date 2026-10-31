import { parseCommand, suggestCommands } from './chat-commands';
import { renderMarkdown } from './markdown';

describe('parseCommand', () => {
  it('treats plain text as a question', () => {
    expect(parseCommand('  how much did I sell? ')).toEqual({ kind: 'prompt', text: 'how much did I sell?' });
  });

  it('handles local commands', () => {
    expect(parseCommand('/help').kind).toBe('help');
    expect(parseCommand('/clear').kind).toBe('clear');
    expect(parseCommand('/scan').kind).toBe('scan');
  });

  it('expands data commands with an optional period', () => {
    const r = parseCommand('/sales last month');
    expect(r.kind).toBe('prompt');
    expect(r.kind === 'prompt' && r.text).toContain('for last month');
    expect(parseCommand('/remind Ravi Stores').kind).toBe('prompt');
  });

  it('navigates for /new and /go', () => {
    expect(parseCommand('/new invoice')).toEqual({ kind: 'navigate', url: '/sales/invoices/new', label: 'New invoice' });
    expect(parseCommand('/go Balance Sheet')).toMatchObject({ kind: 'navigate', url: '/reports/balance-sheet' });
  });

  it('reports bad usage and unknown commands', () => {
    expect(parseCommand('/find').kind).toBe('error');
    expect(parseCommand('/new spaceship').kind).toBe('error');
    expect(parseCommand('/dance').kind).toBe('error');
  });

  it('suggests matching commands while typing', () => {
    expect(suggestCommands('/s').map((c) => c.name)).toEqual(['scan', 'summary', 'sales', 'stock']);
    expect(suggestCommands('/sales x')).toEqual([]);
    expect(suggestCommands('hello')).toEqual([]);
  });
});

describe('renderMarkdown', () => {
  it('escapes html', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });

  it('renders bold, lists and safe links only', () => {
    const html = renderMarkdown('**Total** due\n- [INV-1](/sales/invoices/1)\n- [bad](javascript:alert(1))');
    expect(html).toContain('<strong>Total</strong>');
    expect(html).toContain('<ul><li><a href="/sales/invoices/1" data-internal="1">INV-1</a></li><li>bad');
    expect(html).not.toContain('javascript');
  });

  it('renders tables', () => {
    const html = renderMarkdown('| Name | Due |\n|---|---|\n| Ravi | 100 |');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Ravi</td><td>100</td>');
  });
});
