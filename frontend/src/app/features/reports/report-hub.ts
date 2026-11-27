import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { REPORTS } from './reports.config';

@Component({
  selector: 'app-report-hub',
  imports: [RouterLink, Icon, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Reports" subtitle="Understand your business at a glance." />
    @for (g of groups; track g) {
      <h3 class="group">{{ g }}</h3>
      <div class="reports">
        @for (r of byGroup(g); track r.key) {
          <a class="card report" [routerLink]="['/reports', r.key]">
            <div class="kpi__icon"><app-icon [name]="r.icon" /></div>
            <div>
              <strong>{{ r.title }}</strong>
              <p class="muted">{{ r.description }}</p>
            </div>
            <app-icon name="chevron-right" class="go" />
          </a>
        }
      </div>
    }
  `,
  styles: `
    .group { margin: 24px 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .group:first-of-type { margin-top: 0; }
    .reports { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
    .report { display: flex; gap: 14px; align-items: center; padding: 18px; color: inherit; text-decoration: none !important; transition: box-shadow .15s, transform .15s; }
    .report:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
    .report p { font-size: 13px; margin-top: 2px; }
    .go { margin-left: auto; color: var(--muted); }
  `,
})
export class ReportHub {
  private readonly regime = inject(AuthStore).organization()?.tax_regime ?? 'gst';
  private readonly reports = REPORTS.filter((r) => !r.regime || r.regime === this.regime).map((r) =>
    r.key === 'tax-summary' && this.regime !== 'gst' ? { ...r, title: this.regime === 'vat' ? 'VAT Summary by Rate' : 'Tax Summary' } : r,
  );
  protected readonly groups = [...new Set(this.reports.map((r) => r.group))];
  protected byGroup(g: string) {
    return this.reports.filter((r) => r.group === g);
  }
}
