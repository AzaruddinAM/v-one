/**
 * Turns the on-screen document (the same layout as Print → Save as PDF) into a PDF file in the browser,
 * without any library: the element is drawn through an SVG <foreignObject>, painted on a canvas,
 * cut into pages and wrapped in a small hand-written PDF (one JPEG per page).
 */

export type Paper = 'A4' | 'Letter' | 'A5';

/** Paper size in PDF points (1/72 inch). */
const PAPER_PT: Record<Paper, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  A5: [419.53, 595.28],
};
const MARGIN_PT = 28; // ≈ 10 mm

/** All CSS rules of the page (component styles included), so the copy looks the same. */
function pageCss(): string {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        // @font-face / @import point at files the SVG image cannot load; skip them.
        if (rule instanceof CSSFontFaceRule || rule instanceof CSSImportRule) continue;
        css += rule.cssText + '\n';
      }
    } catch {
      /* cross-origin stylesheet: unreadable, skip */
    }
  }
  return css;
}

/** Custom properties (--accent, --muted…) of the element, copied so they survive outside the page. */
function cssVars(el: HTMLElement): string {
  const out: string[] = [];
  for (const node of [document.documentElement, el]) {
    const cs = getComputedStyle(node);
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      if (p.startsWith('--')) out.push(`${p}:${cs.getPropertyValue(p)}`);
    }
  }
  return out.join(';');
}

/** Page width the document is laid out at, whatever the screen size (a phone gets the desktop layout too). */
const LAYOUT_WIDTH = 820;

async function renderToCanvas(el: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  // Lay a copy out off-screen at a fixed width to measure its height.
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${LAYOUT_WIDTH}px;pointer-events:none;`;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.maxWidth = 'none';
  clone.style.width = LAYOUT_WIDTH + 'px';
  host.appendChild(clone);
  (el.parentElement ?? document.body).appendChild(host);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const width = LAYOUT_WIDTH;
  const height = Math.ceil(clone.scrollHeight);
  const vars = cssVars(clone);
  host.remove();
  const xhtml = new XMLSerializer().serializeToString(clone);
  const font = getComputedStyle(document.body).fontFamily.replace(/"/g, "'");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;background:#fff;font-family:${font};${vars.replace(/"/g, "'")}">` +
    `<style>${pageCss().replace(/<\/style/gi, '')}</style>${xhtml}</div></foreignObject></svg>`;

  const img = new Image();
  img.decoding = 'sync';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Minimal PDF 1.4 writer: one full-page JPEG per page. */
export function buildPdf(pages: { jpeg: Uint8Array; w: number; h: number }[], paper: [number, number], title = ''): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const b = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(b);
    length += b.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  const [pw, ph] = paper;
  const n = pages.length;
  // 1 catalog, 2 pages, 3 info, then per page: page, content, image.
  const pageId = (i: number) => 4 + i * 3;
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>`));
  const safeTitle = title.replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '');
  obj(3, () => push(`<< /Producer (VelouraOne) /Title (${safeTitle}) >>`));
  pages.forEach((p, i) => {
    const id = pageId(i);
    // Fit the slice into the page inside the margins, top aligned.
    const boxW = pw - MARGIN_PT * 2;
    const drawH = (p.h / p.w) * boxW;
    const y = ph - MARGIN_PT - drawH;
    const content = `q ${boxW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${MARGIN_PT} ${y.toFixed(2)} cm /Im0 Do Q`;
    obj(id, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`),
    );
    obj(id + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(id + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      push('\nendstream');
    });
  });
  const xref = length;
  const total = 4 + n * 3;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(table);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

/** PDF of an element, split over as many pages as needed. */
export async function elementToPdf(el: HTMLElement, paper: Paper = 'A4', title = ''): Promise<Blob> {
  const size = PAPER_PT[paper] ?? PAPER_PT.A4;
  const canvas = await renderToCanvas(el, 2);
  const boxW = size[0] - MARGIN_PT * 2;
  const boxH = size[1] - MARGIN_PT * 2;
  const sliceH = Math.floor(canvas.width * (boxH / boxW));
  const pages: { jpeg: Uint8Array; w: number; h: number }[] = [];
  for (let top = 0; top < canvas.height; top += sliceH) {
    const h = Math.min(sliceH, canvas.height - top);
    if (h < 8 && pages.length) break; // a sliver of padding: not worth a page
    const part = document.createElement('canvas');
    part.width = canvas.width;
    part.height = h;
    const ctx = part.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, part.width, h);
    ctx.drawImage(canvas, 0, top, canvas.width, h, 0, 0, canvas.width, h);
    pages.push({ jpeg: dataUrlBytes(part.toDataURL('image/jpeg', 0.9)), w: part.width, h });
  }
  return buildPdf(pages, size, title);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
