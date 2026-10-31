/**
 * Tiny Markdown → HTML renderer for chat replies (bold, italics, code, links, lists, tables, headings).
 * Everything is HTML-escaped first, and only relative app links or http(s) links are produced.
 */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
      if (href.startsWith('/') && !href.startsWith('//')) return `<a href="${href}" data-internal="1">${text}</a>`;
      if (/^https?:\/\//i.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      return text;
    });
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));

export function renderMarkdown(src: string): string {
  const lines = escape(src.replace(/\r\n/g, '\n')).split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      closeList();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      out.push(`<pre><code>${code.join('\n')}</code></pre>`);
      continue;
    }
    // Table: header row followed by a |---| separator
    if (line.includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      closeList();
      const head = cells(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) body.push(cells(lines[i++]));
      i--;
      out.push(
        `<div class="md-table"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
          body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
          '</tbody></table></div>',
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      out.push(`<h4>${inline(heading[2])}</h4>`);
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (list !== type) {
        closeList();
        out.push(`<${type}>`);
        list = type;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
      continue;
    }
    closeList();
    if (line.trim() === '') continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('');
}
