import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { DocumentType, Organization } from '../../core/api/models';
import { DOC_CONFIG } from '../../core/documents.config';
import { AuthStore } from '../../core/auth/auth.store';
import { injectPreferences, Preferences } from '../../core/preferences';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';

/** Settings → Features: switch app features on or off for the whole organization. */
@Component({
  selector: 'app-feature-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!auth.isAdmin()) {
      <div class="alert alert--info mb-2">Only administrators can change these settings.</div>
    }
    <fieldset class="card" [disabled]="!auth.isAdmin() || saving()">
      <div class="card__header">
        <div>
          <h2>Lists and tables</h2>
          <p class="muted">How the lists of invoices, bills, estimates, items, customers, expenses and payments behave.</p>
        </div>
      </div>
      <div class="card__body">
        <label class="checkbox">
          <input type="checkbox" [checked]="prefs().table_filters" (change)="save({ table_filters: $any($event.target).checked })" />
          Column sorting and filters
        </label>
        <p class="muted small">Click a column title to sort by it (again to reverse, a third time to reset). A <strong>Filters</strong> button above each list opens a row of boxes to filter by number, customer, status, dates and amount ranges.</p>
      </div>
    </fieldset>

    <fieldset class="card" [disabled]="!auth.isAdmin() || saving()">
      <div class="card__header">
        <div>
          <h2>Line item photos</h2>
          <p class="muted">Show product photos on estimates and other documents, in the app and on the PDF. Add a photo to an item once, or to any single line.</p>
        </div>
      </div>
      <div class="card__body grid">
        <label class="checkbox">
          <input type="checkbox" [checked]="prefs().line_images" (change)="save({ line_images: $any($event.target).checked })" />
          Allow photos on document lines
        </label>
        @if (prefs().line_images) {
          <div>
            <span class="label">Show on</span>
            <div class="types">
              @for (t of docTypes; track t.type) {
                <label class="checkbox"><input type="checkbox" [checked]="prefs().line_image_docs.includes(t.type)" (change)="toggleDoc(t.type, $any($event.target).checked)" /> {{ t.plural }}</label>
              }
            </div>
          </div>
          <div class="row">
            <label class="field">
              <span>Where on the PDF</span>
              <select class="select" [value]="prefs().line_image_layout" (change)="save({ line_image_layout: $any($event.target).value })">
                <option value="column">Thumbnail beside the item name</option>
                <option value="below">Larger photo under the item</option>
                <option value="gallery">Photo gallery after the items table</option>
              </select>
            </label>
            <label class="field">
              <span>Photo size</span>
              <select class="select" [value]="prefs().line_image_size" (change)="save({ line_image_size: $any($event.target).value })">
                <option value="s">Small</option>
                <option value="m">Medium</option>
                <option value="l">Large</option>
              </select>
            </label>
          </div>
          <p class="muted small">Photos are shrunk to at most 600 × 600 px when uploaded, so PDFs stay light.</p>
        }
      </div>
    </fieldset>

    <fieldset class="card" [disabled]="!auth.isAdmin() || saving()">
      <div class="card__header">
        <div>
          <h2>Barcode and QR scanning</h2>
          <p class="muted">Add items to invoices, bills and estimates by scanning, and save each item's barcode on the item page.</p>
        </div>
      </div>
      <div class="card__body">
        <label class="checkbox">
          <input type="checkbox" [checked]="prefs().barcode_scan" (change)="save({ barcode_scan: $any($event.target).checked })" />
          Scan items on invoices, bills and estimates
        </label>
        <p class="muted small">
          <strong>Phone camera:</strong> works in Chrome on Android (and Chrome or Edge on a Mac). iPhones and Windows PCs can't read barcodes with the camera in the browser yet, so use a scanner there.
          <strong>USB or Bluetooth scanner:</strong> just scan while the invoice is open; a scan of a code already on the bill adds one more.
          Codes match the item's Barcode field first, then its SKU.
        </p>
      </div>
    </fieldset>

    <fieldset class="card" [disabled]="!auth.isAdmin() || saving()">
      <div class="card__header">
        <div>
          <h2>Voice input</h2>
          <p class="muted">Say the items in English, Malayalam or Arabic, for example "2 LED strips at 50 and one driver".</p>
        </div>
      </div>
      <div class="card__body">
        <label class="checkbox">
          <input type="checkbox" [checked]="prefs().voice_input" (change)="save({ voice_input: $any($event.target).checked })" />
          "Speak items" button on invoices, bills, estimates and orders
        </label>
        <p class="muted small">Works in Chrome, Edge and Safari. The words are shown so you can correct them, then the AI assistant turns them into lines matched to your items (and finds the customer if you name one). Without the AI key, simple English like "3 fans at 1200" still works.</p>
      </div>
    </fieldset>
  `,
  styles: `
    fieldset.card { border: 1px solid var(--border); padding: 0; margin: 0 0 16px; min-width: 0; }
    .small { font-size: 12.5px; margin: 6px 0 0 26px; }
    .mb-2 { margin-bottom: 12px; }
    .grid { display: grid; gap: 14px; }
    .types { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 6px; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
    .row .field { display: flex; flex-direction: column; gap: 4px; min-width: 240px; }
    .label { font-weight: 600; font-size: 13px; }
    .grid .small { margin-left: 0; }
  `,
})
export class FeatureSettings {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly prefs = injectPreferences();
  protected readonly saving = signal(false);

  protected readonly docTypes = Object.values(DOC_CONFIG);

  toggleDoc(type: DocumentType, on: boolean): void {
    const cur = this.prefs().line_image_docs.filter((t) => t !== type);
    this.save({ line_image_docs: on ? [...cur, type] : cur });
  }

  save(patch: Partial<Preferences>): void {
    this.saving.set(true);
    this.api.put<Organization>('organization/preferences', patch).subscribe({
      next: (o) => {
        this.saving.set(false);
        this.auth.setOrganization(o);
        this.toast.success('Saved');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
