import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

/** Whether the filter row of a list is open; remembered in this browser per list. */
export function filterRowOpen(listKey: string) {
  const storageKey = 'v1.filters.' + listKey;
  let initial = false;
  try {
    initial = localStorage.getItem(storageKey) === '1';
  } catch {
    /* storage blocked: start closed */
  }
  const open = signal(initial);
  effect(() => {
    try {
      localStorage.setItem(storageKey, open() ? '1' : '0');
    } catch {
      /* ignore */
    }
  });
  return open;
}

export interface SortState {
  field: string;
  dir: 'asc' | 'desc';
}

/**
 * Sortable column header: <th appSort="date" [sortState]="store.sortState()" (sorted)="store.toggleSort($event)">Date</th>.
 * When sorting is switched off in Settings → Features it renders as a plain header.
 */
@Component({
  selector: 'th[appSort]',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-sort]': 'aria()' },
  template: `
    <!-- Projected once into a template, so the label shows whether or not sorting is on. -->
    <ng-template #label><ng-content /></ng-template>
    @if (enabled()) {
      <button type="button" class="th-sort" [class.is-sorted]="dir()" (click)="sorted.emit(appSort())">
        <ng-container [ngTemplateOutlet]="label" />
        <span class="th-sort__arrow" aria-hidden="true">{{ dir() === 'asc' ? '▲' : dir() === 'desc' ? '▼' : '↕' }}</span>
      </button>
    } @else {
      <ng-container [ngTemplateOutlet]="label" />
    }
  `,
})
export class SortHeader {
  readonly appSort = input.required<string>();
  readonly sortState = input<SortState | null>(null);
  readonly enabled = input(true);
  readonly sorted = output<string>();

  protected readonly dir = computed(() => (this.sortState()?.field === this.appSort() ? this.sortState()!.dir : null));
  protected readonly aria = computed(() => (this.dir() === 'asc' ? 'ascending' : this.dir() === 'desc' ? 'descending' : null));
}

export type ColFilterKind = 'text' | 'range' | 'dates' | 'select';

/**
 * One cell of the filter row under a table header. Emits (key, value) pairs:
 * text/select → key; range → key_min / key_max; dates → key_from / key_to.
 */
@Component({
  selector: 'app-col-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (kind()) {
      @case ('select') {
        <select class="col-filter" [attr.aria-label]="'Filter ' + label()" (change)="emit(key(), $any($event.target).value)">
          <option value="">All</option>
          @for (o of options(); track o) { <option [value]="o">{{ o }}</option> }
        </select>
      }
      @case ('range') {
        <div class="col-filter__pair">
          <input class="col-filter" type="number" inputmode="decimal" placeholder="Min" [attr.aria-label]="label() + ' from'" (input)="emit(key() + '_min', $any($event.target).value)" />
          <input class="col-filter" type="number" inputmode="decimal" placeholder="Max" [attr.aria-label]="label() + ' to'" (input)="emit(key() + '_max', $any($event.target).value)" />
        </div>
      }
      @case ('dates') {
        <div class="col-filter__pair col-filter__pair--dates">
          <input class="col-filter" type="date" [attr.aria-label]="label() + ' from'" (change)="emit(key() + '_from', $any($event.target).value)" />
          <input class="col-filter" type="date" [attr.aria-label]="label() + ' to'" (change)="emit(key() + '_to', $any($event.target).value)" />
        </div>
      }
      @default {
        <input class="col-filter" type="search" placeholder="Filter…" [attr.aria-label]="'Filter ' + label()" (input)="emit(key(), $any($event.target).value)" />
      }
    }
  `,
})
export class ColFilter {
  readonly key = input.required<string>();
  readonly kind = input<ColFilterKind>('text');
  readonly label = input('');
  readonly options = input<string[]>([]);
  readonly changed = output<{ key: string; value: string }>();

  protected emit(key: string, value: string): void {
    this.changed.emit({ key, value });
  }
}
