import { amountInWords, ARABIC_TITLES, DEFAULT_PDF_OPTIONS, numberToWords, orgPdfAccent, orgPdfOptions, orgPdfTemplate, PDF_TEMPLATES, pdfTemplatesFor } from './pdf-templates';

describe('numberToWords', () => {
  it('spells small numbers', () => {
    expect(numberToWords(0)).toBe('Zero');
    expect(numberToWords(7)).toBe('Seven');
    expect(numberToWords(19)).toBe('Nineteen');
    expect(numberToWords(40)).toBe('Forty');
    expect(numberToWords(99)).toBe('Ninety Nine');
    expect(numberToWords(305)).toBe('Three Hundred Five');
  });

  it('uses lakh and crore in the Indian system', () => {
    expect(numberToWords(125_000)).toBe('One Lakh Twenty Five Thousand');
    expect(numberToWords(12_345_678)).toBe('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight');
    expect(numberToWords(12_340_000_000)).toBe('One Thousand Two Hundred Thirty Four Crore');
  });

  it('uses million in the international system', () => {
    expect(numberToWords(2_500_000, false)).toBe('Two Million Five Hundred Thousand');
  });
});

describe('amountInWords', () => {
  it('formats rupees and paise', () => {
    expect(amountInWords(1250.5)).toBe('Rupees One Thousand Two Hundred Fifty and Fifty Paise Only');
    expect(amountInWords(118)).toBe('Rupees One Hundred Eighteen Only');
  });

  it('handles floating point totals and other currencies', () => {
    expect(amountInWords(0.1 + 0.2)).toBe('Rupees Zero and Thirty Paise Only');
    expect(amountInWords(1_000_000, 'USD')).toBe('Dollars One Million Only');
  });
});

describe('organization PDF settings', () => {
  it('falls back to defaults for missing or unknown values', () => {
    expect(orgPdfTemplate(null)).toBe('classic');
    expect(orgPdfTemplate({ pdf_template: 'fancy' } as never)).toBe('classic');
    expect(orgPdfTemplate({ pdf_template: 'gst' } as never)).toBe('gst');
    expect(orgPdfAccent({ pdf_accent: 'red' } as never)).toBe('#4f46e5');
    expect(orgPdfAccent({ pdf_accent: '#0f766e' } as never)).toBe('#0f766e');
  });
});

describe('orgPdfOptions', () => {
  it('returns defaults when nothing is saved', () => {
    expect(orgPdfOptions(null)).toEqual(DEFAULT_PDF_OPTIONS);
  });

  it('keeps saved values and drops wrongly typed or unknown ones', () => {
    const o = orgPdfOptions({ pdf_options: { show_tax_column: false, logo: 'data:image/png;base64,AA', font: 'serif', show_notes: 'no', hack: 1 } } as never);
    expect(o.show_tax_column).toBe(false);
    expect(o.logo).toBe('data:image/png;base64,AA');
    expect(o.font).toBe('serif');
    expect(o.show_notes).toBe(true);
    expect((o as never as Record<string, unknown>)['hack']).toBeUndefined();
  });
});

describe('template list', () => {
  it('has unique ids', () => {
    const ids = PDF_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers the UAE bilingual layout to VAT organizations only', () => {
    expect(pdfTemplatesFor({ tax_regime: 'vat' }).some((t) => t.id === 'bilingual')).toBe(true);
    expect(pdfTemplatesFor({ tax_regime: 'gst' }).some((t) => t.id === 'bilingual')).toBe(false);
    expect(pdfTemplatesFor(null).some((t) => t.id === 'elegant')).toBe(true);
  });

  it('keeps a saved new template', () => {
    expect(orgPdfTemplate({ pdf_template: 'creative' } as never)).toBe('creative');
  });

  it('has Arabic titles for invoices, estimates and purchase orders', () => {
    expect(ARABIC_TITLES.tax_invoice).toBe('فاتورة ضريبية');
    expect(ARABIC_TITLES.estimate).toBeTruthy();
    expect(ARABIC_TITLES.purchase_order).toBeTruthy();
  });
});
