import { Organization, TaxRegime } from './api/models';

/** Labels and rules that differ between India GST, UAE VAT and a plain sales-tax setup. */
export interface TaxProfile {
  regime: TaxRegime;
  /** Short tax name: GST, VAT or Tax. */
  tax: string;
  /** Registration number label: GSTIN, TRN or Tax ID. */
  idLabel: string;
  idPlaceholder: string;
  /** India: intra-state GST is printed as CGST + SGST. */
  splitCgstSgst: boolean;
  /** Seller registered for tax → "TAX INVOICE" title. */
  taxInvoiceTitle: string;
}

export const TAX_REGIMES: { id: TaxRegime; label: string; hint: string }[] = [
  { id: 'gst', label: 'India GST', hint: 'GSTIN, CGST / SGST / IGST, GST summary report' },
  { id: 'vat', label: 'UAE VAT', hint: 'TRN, 5% / zero-rated / exempt VAT, VAT return (VAT 201) report' },
  { id: 'none', label: 'Other / no tax registration', hint: 'Plain sales tax labels' },
];

/** Sensible defaults when an organization switches regime in Settings. */
export const REGIME_DEFAULTS: Record<TaxRegime, { currency: string; currency_symbol: string; fiscal_year_start: number; country: string }> = {
  gst: { currency: 'INR', currency_symbol: '₹', fiscal_year_start: 4, country: 'India' },
  vat: { currency: 'AED', currency_symbol: 'AED', fiscal_year_start: 1, country: 'United Arab Emirates' },
  none: { currency: 'USD', currency_symbol: '$', fiscal_year_start: 1, country: '' },
};

export function taxProfile(org: Pick<Organization, 'tax_regime'> | null | undefined): TaxProfile {
  const regime: TaxRegime = org?.tax_regime ?? 'gst';
  switch (regime) {
    case 'vat':
      return { regime, tax: 'VAT', idLabel: 'TRN', idPlaceholder: '100123456700003', splitCgstSgst: false, taxInvoiceTitle: 'TAX INVOICE' };
    case 'none':
      return { regime, tax: 'Tax', idLabel: 'Tax ID', idPlaceholder: '', splitCgstSgst: false, taxInvoiceTitle: 'INVOICE' };
    default:
      return { regime: 'gst', tax: 'GST', idLabel: 'GSTIN', idPlaceholder: '22AAAAA0000A1Z5', splitCgstSgst: true, taxInvoiceTitle: 'TAX INVOICE' };
  }
}
