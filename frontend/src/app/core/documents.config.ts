import { ContactType, DocumentType } from './api/models';

export interface DocConfig {
  type: DocumentType;
  label: string;
  plural: string;
  path: string;
  contactType: ContactType;
  icon: string;
  dueLabel: string;
  payable: boolean;
  convertTo?: DocumentType;
  priceField: 'sales_price' | 'purchase_price';
}

export const DOC_CONFIG: Record<DocumentType, DocConfig> = {
  estimate: { type: 'estimate', label: 'Estimate', plural: 'Estimates', path: '/sales/estimates', contactType: 'customer', icon: 'estimate', dueLabel: 'Expiry date', payable: false, convertTo: 'invoice', priceField: 'sales_price' },
  delivery_challan: { type: 'delivery_challan', label: 'Delivery Challan', plural: 'Delivery Challans', path: '/sales/delivery-challans', contactType: 'customer', icon: 'truck', dueLabel: 'Delivery date', payable: false, convertTo: 'invoice', priceField: 'sales_price' },
  sales_order: { type: 'sales_order', label: 'Sales Order', plural: 'Sales Orders', path: '/sales/orders', contactType: 'customer', icon: 'cart', dueLabel: 'Shipment date', payable: false, convertTo: 'invoice', priceField: 'sales_price' },
  invoice: { type: 'invoice', label: 'Invoice', plural: 'Invoices', path: '/sales/invoices', contactType: 'customer', icon: 'invoice', dueLabel: 'Due date', payable: true, priceField: 'sales_price' },
  credit_note: { type: 'credit_note', label: 'Credit Note', plural: 'Credit Notes', path: '/sales/credit-notes', contactType: 'customer', icon: 'return', dueLabel: 'Valid till', payable: false, priceField: 'sales_price' },
  purchase_order: { type: 'purchase_order', label: 'Purchase Order', plural: 'Purchase Orders', path: '/purchases/orders', contactType: 'vendor', icon: 'cart', dueLabel: 'Expected delivery', payable: false, convertTo: 'bill', priceField: 'purchase_price' },
  bill: { type: 'bill', label: 'Bill', plural: 'Bills', path: '/purchases/bills', contactType: 'vendor', icon: 'receipt', dueLabel: 'Due date', payable: true, priceField: 'purchase_price' },
  vendor_credit: { type: 'vendor_credit', label: 'Vendor Credit', plural: 'Vendor Credits', path: '/purchases/vendor-credits', contactType: 'vendor', icon: 'return', dueLabel: 'Valid till', payable: false, priceField: 'purchase_price' },
};

export function docPath(type: DocumentType, id?: number): string {
  return id ? `${DOC_CONFIG[type].path}/${id}` : DOC_CONFIG[type].path;
}
