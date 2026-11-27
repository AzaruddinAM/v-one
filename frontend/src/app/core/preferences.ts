import { computed, inject } from '@angular/core';
import { DocumentType, Organization } from './api/models';
import { AuthStore } from './auth/auth.store';

export type LineImageSize = 's' | 'm' | 'l';
/** column = thumbnail beside the item name · below = larger photo under the line · gallery = all photos together after the table. */
export type LineImageLayout = 'column' | 'below' | 'gallery';

/** Feature switches per organization (Settings → Features). Stored as JSON on the organization. */
export interface Preferences {
  /** Sortable column headers and a filter row on list tables. */
  table_filters: boolean;
  /** Product photos on document lines and in the PDF. */
  line_images: boolean;
  /** Document types that show line photos. */
  line_image_docs: DocumentType[];
  line_image_size: LineImageSize;
  line_image_layout: LineImageLayout;
  /** Scan barcodes / QR codes (camera or USB scanner) to add items. */
  barcode_scan: boolean;
  /** Speak items (English, Malayalam, Arabic) to add them to a document. */
  voice_input: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  table_filters: true,
  line_images: false,
  line_image_docs: ['estimate'],
  line_image_size: 'm',
  line_image_layout: 'column',
  barcode_scan: true,
  voice_input: true,
};

export function preferencesOf(org: Organization | null | undefined): Preferences {
  return { ...DEFAULT_PREFERENCES, ...(org?.preferences ?? {}) };
}

/** Line photos are switched on for this document type. */
export function lineImagesFor(p: Preferences, type: DocumentType): boolean {
  return p.line_images && p.line_image_docs.includes(type);
}

/** Signal of the current organization's preferences, for use in a component field initializer. */
export function injectPreferences() {
  const auth = inject(AuthStore);
  return computed(() => preferencesOf(auth.organization()));
}
