import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const TONES: Record<string, string> = {
  draft: 'neutral',
  sent: 'info',
  open: 'info',
  partial: 'warning',
  overdue: 'danger',
  paid: 'success',
  accepted: 'success',
  closed: 'success',
  declined: 'danger',
  void: 'muted',
  active: 'success',
  inactive: 'muted',
  delivered: 'success',
  invoiced: 'success',
  returned: 'warning',
  paused: 'warning',
  expired: 'muted',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [attr.data-tone]="tone()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<string>();
  protected readonly tone = computed(() => TONES[this.status()] ?? 'neutral');
  protected readonly label = computed(() => this.status().replace(/_/g, ' '));
}
