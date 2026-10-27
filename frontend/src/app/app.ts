import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmService } from './core/ui/confirm.service';
import { ToastService } from './core/ui/toast.service';
import { Icon } from './shared/icon';
import { Modal } from './shared/modal';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Icon, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />

    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [attr.data-kind]="t.kind" (click)="toast.dismiss(t.id)">
          <app-icon [name]="t.kind === 'error' ? 'alert' : 'check'" />
          <span>{{ t.text }}</span>
        </div>
      }
    </div>

    @if (confirm.current(); as c) {
      <app-modal [title]="c.title" [width]="420" (closed)="confirm.close(false)">
        <p class="muted">{{ c.message }}</p>
        <ng-container modal-footer>
          <button type="button" class="btn btn--outline" (click)="confirm.close(false)">Cancel</button>
          <button type="button" class="btn" [class.btn--danger]="c.danger" (click)="confirm.close(true)">{{ c.confirmText ?? 'Confirm' }}</button>
        </ng-container>
      </app-modal>
    }
  `,
})
export class App {
  protected readonly toast = inject(ToastService);
  protected readonly confirm = inject(ConfirmService);
}
