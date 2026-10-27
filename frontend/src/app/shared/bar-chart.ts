import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatMoney } from './money.pipe';

export interface BarSeries {
  label: string;
  values: number[];
  color: string;
}

/** Lightweight grouped bar chart in pure SVG (no chart library → smaller bundle). */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <div class="chart__legend">
        @for (s of series(); track s.label) {
          <span><i [style.background]="s.color"></i>{{ s.label }}</span>
        }
      </div>
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" class="chart__svg" role="img" aria-label="Bar chart">
        @for (t of ticks(); track t.y) {
          <line [attr.x1]="P" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" class="chart__grid" />
          <text [attr.x]="P - 6" [attr.y]="t.y + 4" text-anchor="end" class="chart__axis">{{ t.label }}</text>
        }
        @for (g of groups(); track g.label; let gi = $index) {
          @for (b of g.bars; track $index) {
            <rect
              [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" [attr.fill]="b.color" rx="3"
              (mouseenter)="hover.set({ group: gi, text: g.label + ' · ' + b.series + ': ' + b.text })"
              (mouseleave)="hover.set(null)"
            />
          }
          <text [attr.x]="g.cx" [attr.y]="H - 6" text-anchor="middle" class="chart__axis">{{ g.label }}</text>
        }
      </svg>
      <div class="chart__tip" [class.is-visible]="hover()">{{ hover()?.text ?? '' }}&nbsp;</div>
    </div>
  `,
})
export class BarChart {
  readonly labels = input<string[]>([]);
  readonly series = input<BarSeries[]>([]);
  readonly currency = input('INR');

  protected readonly W = 720;
  protected readonly H = 260;
  protected readonly P = 56;
  private readonly bottom = 26;
  protected readonly hover = signal<{ group: number; text: string } | null>(null);

  private readonly max = computed(() => {
    const m = Math.max(0, ...this.series().flatMap((s) => s.values));
    if (m <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / mag) * mag;
  });

  protected readonly ticks = computed(() => {
    const plotH = this.H - this.bottom - 10;
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: 10 + plotH * (1 - f),
      label: this.short(this.max() * f),
    }));
  });

  protected readonly groups = computed(() => {
    const labels = this.labels();
    const series = this.series();
    const n = Math.max(1, labels.length);
    const plotW = this.W - this.P;
    const plotH = this.H - this.bottom - 10;
    const gw = plotW / n;
    const bw = Math.min(18, (gw * 0.7) / Math.max(1, series.length));
    return labels.map((label, i) => {
      const start = this.P + i * gw + (gw - bw * series.length) / 2;
      return {
        label,
        cx: this.P + i * gw + gw / 2,
        bars: series.map((s, si) => {
          const v = s.values[i] ?? 0;
          const h = Math.max(v > 0 ? 2 : 0, (v / this.max()) * plotH);
          return { x: start + si * bw, y: 10 + plotH - h, w: bw - 2, h, color: s.color, series: s.label, text: formatMoney(v, this.currency()) };
        }),
      };
    });
  });

  private short(v: number): string {
    if (v >= 1e7) return (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (v >= 1e5) return (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(v));
  }
}
