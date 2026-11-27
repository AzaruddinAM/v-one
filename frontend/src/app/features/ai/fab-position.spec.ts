import { clampFab, defaultFab, loadFabPosition, saveFabPosition, snapFab } from './fab-position';

describe('assistant button position', () => {
  beforeEach(() => localStorage.clear());

  it('snaps a drop to the nearer side and keeps its height', () => {
    expect(snapFab(20, 400, 375, 780)).toEqual({ side: 'left', bottom: 324 });
    expect(snapFab(300, 600, 375, 780)).toEqual({ side: 'right', bottom: 124 });
  });

  it('keeps the button between the bottom margin and the top bar', () => {
    expect(clampFab({ side: 'right', bottom: -50 }, 375, 780).bottom).toBe(16);
    expect(clampFab({ side: 'right', bottom: 5000 }, 375, 780).bottom).toBe(780 - 56 - 60 - 8);
    expect(clampFab({ side: 'left', bottom: 5 }, 1280, 800).bottom).toBe(22);
  });

  it('remembers the position and ignores bad saved data', () => {
    saveFabPosition({ side: 'left', bottom: 200 });
    expect(loadFabPosition()).toEqual({ side: 'left', bottom: 200 });
    localStorage.setItem('v-one.assistant-button', '{"side":"up","bottom":"x"}');
    expect(loadFabPosition()).toEqual(defaultFab());
  });
});
