import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { Organization } from '../../core/api/models';
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
  `,
  styles: `
    fieldset.card { border: 1px solid var(--border); padding: 0; margin: 0 0 16px; min-width: 0; }
    .small { font-size: 12.5px; margin: 6px 0 0 26px; }
    .mb-2 { margin-bottom: 12px; }
  `,
})
export class FeatureSettings {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthStore);
  protected readonly prefs = injectPreferences();
  protected readonly saving = signal(false);

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
