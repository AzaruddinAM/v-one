import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pagination">
      <span class="muted">{{ label() }}</span>
      <div class="pagination__controls">
        <button type="button" class="btn btn--ghost btn--icon" [disabled]="page() <= 1" (click)="go.emit(page() - 1)" aria-label="Previous page">
          <app-icon name="chevron-left" />
        </button>
        <span class="pagination__page">{{ page() }} / {{ lastPage() }}</span>
        <button type="button" class="btn btn--ghost btn--icon" [disabled]="page() >= lastPage()" (click)="go.emit(page() + 1)" aria-label="Next page">
          <app-icon name="chevron-right" />
        </button>
      </div>
    </div>
  `,
})
export class Pagination {
  readonly page = input(1);
  readonly lastPage = input(1);
  readonly label = input('');
  readonly go = output<number>();
}
