import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, of, switchMap, catchError } from 'rxjs';

/**
 * Accessible-ish async autocomplete. Free text is allowed (text model),
 * picking an option emits `picked` with the full object.
 *
 * The menu is `position: fixed` and placed from the input's screen position,
 * so it is never clipped by a scrolling parent (e.g. the line-items
 * `.table-wrap`, whose `overflow-x: auto` used to cut it off). It flips above
 * the input when there is no room below and stays inside the viewport.
 */
@Component({
  selector: 'app-typeahead',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'typeahead',
    '(document:click)': 'onDocClick($event)',
    '(window:resize)': 'place()',
  },
  template: `
    <input
      #field
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
      <ul
        class="ta-menu"
        role="listbox"
        [style.left.px]="pos().left"
        [style.width.px]="pos().width"
        [style.top.px]="pos().top"
        [style.bottom.px]="pos().bottom"
        [style.max-height.px]="pos().maxHeight"
      >
        @if (loading() && !options().length) {
          <li class="ta-empty">Searching…</li>
        }
        @for (o of options(); track $index) {
          <li role="option" [class.is-active]="$index === active()" (mousedown)="pick(o, $event)">
            <span class="ta-name" [title]="display()(o)">{{ display()(o) }}</span>
            @if (meta()(o); as m) { <small>{{ m }}</small> }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .ta-menu { position: fixed; z-index: 1000; margin: 0; padding: 4px; list-style: none; box-sizing: border-box;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg);
      overflow-y: auto; overscroll-behavior: contain; }
    li { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 6px; cursor: pointer; }
    li.is-active, li:hover { background: var(--primary-50); }
    .ta-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; line-height: 1.35;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
    li small { flex: 0 0 auto; color: var(--muted); white-space: nowrap; }
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
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  protected readonly pos = signal<{ left: number; width: number; top: number | null; bottom: number | null; maxHeight: number }>({
    left: 0, width: 280, top: 0, bottom: null, maxHeight: 260,
  });

  constructor() {
    // Follow the input when any ancestor scrolls (page, app shell, or the table wrapper).
    const onScroll = (e: Event) => {
      if (this.isOpen() && !(e.target instanceof Node && this.host.nativeElement.contains(e.target))) this.place();
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll, { capture: true }));

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

  /** Places the fixed menu next to the input, flipping up and clamping to the viewport. */
  place(): void {
    if (!this.isOpen()) return;
    const r = this.field().nativeElement.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const margin = 8;
    const width = Math.min(Math.max(r.width, 280), vw - margin * 2);
    const left = Math.min(Math.max(r.left, margin), vw - width - margin);
    const below = vh - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    const up = below < 180 && above > below;
    const maxHeight = Math.max(120, Math.min(300, up ? above : below));
    this.pos.set(
      up
        ? { left, width, top: null, bottom: vh - r.top + gap, maxHeight }
        : { left, width, top: r.bottom + gap, bottom: null, maxHeight },
    );
  }

  open(): void {
    this.isOpen.set(true);
    this.place();
    this.query$.next(this.text());
  }

  onInput(v: string): void {
    this.text.set(v);
    this.isOpen.set(true);
    this.place();
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
