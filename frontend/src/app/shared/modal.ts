import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="modal-backdrop" (click)="closed.emit()"></div>
    <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="title()" [style.max-width.px]="width()">
      <header class="modal__header">
        <h2>{{ title() }}</h2>
        <button type="button" class="btn btn--ghost btn--icon" (click)="closed.emit()" aria-label="Close"><app-icon name="x" /></button>
      </header>
      <div class="modal__body"><ng-content /></div>
      <footer class="modal__footer"><ng-content select="[modal-footer]" /></footer>
    </div>
  `,
})
export class Modal {
  readonly title = input('');
  readonly width = input(520);
  readonly closed = output<void>();
}
