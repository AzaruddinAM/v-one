import { amountInWords, numberToWords, orgPdfAccent, orgPdfTemplate } from './pdf-templates';

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
