import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { Tax } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth.store';
import { taxProfile } from '../../core/tax-regime';
import { LookupsStore } from '../../core/state/lookups.store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-tax-settings',
  imports: [FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="card__header">
        <div><h2>Tax rates</h2><p class="muted">GST, VAT or any sales tax applied on items and transactions. For UAE VAT use type <strong>VAT</strong> for 5% and zero-rated, and <strong>EXEMPT</strong> for exempt supplies (VAT return box 5).</p></div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th style="width:140px">Rate (%)</th><th style="width:140px">Type</th><th style="width:100px">Active</th><th></th></tr></thead>
          <tbody>
            @for (t of taxes(); track t.id) {
              <tr>
                <td><input class="input input--sm" [(ngModel)]="t.name" [disabled]="!auth.canDelete()" /></td>
                <td><input class="input input--sm" type="number" min="0" max="100" step="0.01" [(ngModel)]="t.rate" [disabled]="!auth.canDelete()" /></td>
                <td><input class="input input--sm" list="tax-types" [(ngModel)]="t.type" [disabled]="!auth.canDelete()" /></td>
                <td><input type="checkbox" [(ngModel)]="t.is_active" [disabled]="!auth.canDelete()" /></td>
                <td class="actions">
                  @if (auth.canDelete()) {
                    <button type="button" class="btn btn--ghost btn--sm" (click)="save(t)">Save</button>
                    <button type="button" class="btn btn--ghost btn--sm btn--icon" (click)="remove(t)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
                  }
                </td>
              </tr>
            }
            @if (auth.canDelete()) {
              <tr>
                <td><input class="input input--sm" placeholder="e.g. IGST 18%" [(ngModel)]="draft.name" /></td>
                <td><input class="input input--sm" type="number" min="0" max="100" step="0.01" [(ngModel)]="draft.rate" /></td>
                <td><input class="input input--sm" list="tax-types" [(ngModel)]="draft.type" /></td>
                <td></td>
                <td class="actions"><button type="button" class="btn btn--sm" (click)="add()" [disabled]="!draft.name"><app-icon name="plus" [size]="16" /> Add</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <datalist id="tax-types"><option value="GST"></option><option value="VAT"></option><option value="EXEMPT"></option><option value="TAX"></option></datalist>
    </div>
  `,
})
export class TaxSettings implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly lookups = inject(LookupsStore);
  protected readonly auth = inject(AuthStore);
  protected readonly taxes = signal<Tax[]>([]);
  protected draft: Partial<Tax> = { name: '', rate: 0, type: this.defaultType() };

  private defaultType(): string {
    return taxProfile(this.auth.organization()).tax.toUpperCase();
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<Tax[]>('taxes').subscribe((t) => this.taxes.set(t));
  }

  private done(msg: string): void {
    this.toast.success(msg);
    this.load();
    this.lookups.load({ force: true });
  }

  add(): void {
    this.api.post<Tax>('taxes', { ...this.draft, is_active: true }).subscribe({
      next: () => {
        this.draft = { name: '', rate: 0, type: this.defaultType() };
        this.done('Tax added');
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  save(t: Tax): void {
    this.api.put<Tax>(`taxes/${t.id}`, t).subscribe({ next: () => this.done('Tax updated'), error: (e) => this.toast.error(errorMessage(e)) });
  }

  async remove(t: Tax): Promise<void> {
    if (await this.confirm.ask(`Delete ${t.name}?`, 'Taxes used in transactions cannot be deleted.', { confirmText: 'Delete', danger: true })) {
      this.api.delete(`taxes/${t.id}`).subscribe({ next: () => this.done('Tax deleted'), error: (e) => this.toast.error(errorMessage(e)) });
    }
  }
}
