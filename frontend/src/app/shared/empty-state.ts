import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <div class="empty__icon"><app-icon [name]="icon()" [size]="28" /></div>
      <h3>{{ title() }}</h3>
      <p class="muted">{{ message() }}</p>
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('layers');
  readonly title = input('Nothing here yet');
  readonly message = input('');
}
