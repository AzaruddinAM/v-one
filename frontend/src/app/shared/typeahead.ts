import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, of, switchMap, catchError } from 'rxjs';

/**
 * Accessible-ish async autocomplete. Free text is allowed (text model),
 * picking an option emits `picked` with the full object.
 */
@Component({
  selector: 'app-typeahead',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'typeahead', '(document:click)': 'onDocClick($event)' },
  template: `
    <input
      class="input"
      [class.input--sm]="small()"
      [id]="inputId()"
      [placeholder]="placeholder()"
      [value]="text()"
      autocomplete="off"
      (input)="onInput($any($event.target).value)"
      (focus)="open()"
      (keydown)="onKey($event)"
    />
    @if (isOpen() && (options().length || loading())) {
      <ul class="ta-menu" role="listbox">
        @if (loading() && !options().length) {
          <li class="ta-empty">Searching…</li>
        }
        @for (o of options(); track $index) {
          <li role="option" [class.is-active]="$index === active()" (mousedown)="pick(o, $event)">
            <span>{{ display()(o) }}</span>
            @if (meta()(o); as m) { <small>{{ m }}</small> }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .ta-menu { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 4px); margin: 0; padding: 4px; list-style: none;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); max-height: 260px; overflow-y: auto; min-width: 240px; }
    li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 6px; cursor: pointer; }
    li.is-active, li:hover { background: var(--primary-50); }
    li small { color: var(--muted); white-space: nowrap; }
    .ta-empty { color: var(--muted); cursor: default; }
  `,
})
export class Typeahead<T> {
  readonly search = input.required<(q: string) => Observable<T[]>>();
  readonly display = input<(o: T) => string>((o) => String(o));
  readonly meta = input<(o: T) => string>(() => '');
  readonly placeholder = input('');
  readonly inputId = input('');
  readonly small = input(false);
  readonly text = model('');
  readonly picked = output<T>();

  protected readonly options = signal<T[]>([]);
  protected readonly isOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly active = signal(0);
  private readonly query$ = new Subject<string>();
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    this.query$
      .pipe(
        debounceTime(200),
        switchMap((q) => {
          this.loading.set(true);
          return this.search()(q).pipe(catchError(() => of([] as T[])));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((opts) => {
        this.options.set(opts);
        this.active.set(0);
        this.loading.set(false);
      });
  }

  open(): void {
    this.isOpen.set(true);
    this.query$.next(this.text());
  }

  onInput(v: string): void {
    this.text.set(v);
    this.isOpen.set(true);
    this.query$.next(v);
  }

  onKey(e: KeyboardEvent): void {
    const n = this.options().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.set(Math.min(n - 1, this.active() + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.set(Math.max(0, this.active() - 1));
    } else if (e.key === 'Enter' && this.isOpen() && n) {
      e.preventDefault();
      this.pick(this.options()[this.active()]);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      this.isOpen.set(false);
    }
  }

  pick(o: T, e?: Event): void {
    e?.preventDefault();
    this.text.set(this.display()(o));
    this.isOpen.set(false);
    this.picked.emit(o);
  }

  protected onDocClick(e: Event): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.isOpen.set(false);
  }
}
