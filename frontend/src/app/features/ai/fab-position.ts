/** Placement of the floating assistant button: which side of the screen it rests on and how high. */
export interface FabPosition {
  side: 'left' | 'right';
  /** Distance from the bottom edge of the viewport to the bottom of the button, in px. */
  bottom: number;
}

export const FAB_SIZE = 56;
const KEY = 'v-one.assistant-button';
const TOPBAR = 60;

export const fabMargin = (vw: number): number => (vw < 640 ? 16 : 22);

/** Left edge for a button on the left side: clear of the sidebar, which is always shown on wide screens. */
export const fabLeftEdge = (vw: number): number => (vw > 960 ? 248 : 0) + fabMargin(vw);

export function defaultFab(vw = window.innerWidth): FabPosition {
  return { side: 'right', bottom: fabMargin(vw) };
}

/** Keep the button inside the visible area, below the top bar. */
export function clampFab(p: FabPosition, vw: number, vh: number): FabPosition {
  const min = fabMargin(vw);
  const max = Math.max(min, vh - FAB_SIZE - TOPBAR - 8);
  return { side: p.side, bottom: Math.round(Math.min(Math.max(p.bottom, min), max)) };
}

/** Turn a drop point (top-left of the button) into a resting place on the nearer side. */
export function snapFab(x: number, y: number, vw: number, vh: number): FabPosition {
  const side = x + FAB_SIZE / 2 < vw / 2 ? 'left' : 'right';
  return clampFab({ side, bottom: vh - y - FAB_SIZE }, vw, vh);
}

export function loadFabPosition(): FabPosition {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<FabPosition>;
      if (
        (p.side === 'left' || p.side === 'right') &&
        typeof p.bottom === 'number' &&
        isFinite(p.bottom)
      )
        return { side: p.side, bottom: p.bottom };
    }
  } catch {
    /* storage unavailable or corrupt: fall back to the default corner */
  }
  return defaultFab();
}

export function saveFabPosition(p: FabPosition): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: position lasts for this page view only */
  }
}

const CONTROLS =
  'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]';
const IGNORE = 'app-chat-widget, .toasts, .modal, .modal-backdrop, .sidebar, .scrim, .topbar';

/** True when the element, or an ancestor, is pinned to the viewport (fixed or sticky). */
function isPinned(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const pos = getComputedStyle(n).position;
    if (pos === 'fixed' || pos === 'sticky') return true;
  }
  return false;
}

/**
 * How far to raise the button so it clears pinned controls (a sticky Save bar, a fixed footer…)
 * that sit under its resting place. Content that scrolls under the button is not counted: it moves away.
 */
export function overlapLift(
  rest: { left: number; bottom: number },
  vh: number,
  self?: HTMLElement | null,
): number {
  const gap = 8;
  const box = {
    left: rest.left - gap,
    right: rest.left + FAB_SIZE + gap,
    bottom: vh - rest.bottom + gap,
  };
  let top = vh - rest.bottom - FAB_SIZE - gap;
  let lift = 0;
  for (let pass = 0; pass < 3; pass++) {
    let highest = Infinity;
    for (const el of Array.from(document.querySelectorAll(CONTROLS))) {
      if (el === self || el.closest(IGNORE)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right <= box.left || r.left >= box.right || r.bottom <= top || r.top >= box.bottom)
        continue;
      if (!isPinned(el)) continue;
      highest = Math.min(highest, r.top);
    }
    if (highest === Infinity) break;
    const need = vh - highest + gap - (rest.bottom + lift);
    if (need <= 0) break;
    lift += need;
    top = vh - rest.bottom - lift - FAB_SIZE - gap;
  }
  // Never push the button off screen; if nothing fits, keep the chosen place.
  return rest.bottom + lift + FAB_SIZE + TOPBAR + 8 > vh ? 0 : Math.round(lift);
}
