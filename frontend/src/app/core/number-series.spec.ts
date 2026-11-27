import { previewNumber, renderPrefix } from './number-series';

describe('number series preview', () => {
  const d = new Date(2026, 7, 10); // 10 Aug 2026
  it('expands placeholders', () => {
    expect(renderPrefix('INV-{YY}-{CODE}-', d, 'tu')).toBe('INV-26-TU-');
    expect(renderPrefix('{YYYY}/{MM}/', d, '')).toBe('2026/08/');
    expect(renderPrefix('INV/{FY}/', d, '', 4)).toBe('INV/26-27/');
    expect(renderPrefix('INV/{FY}/', new Date(2026, 1, 1), '', 4)).toBe('INV/25-26/');
  });
  it('pads the running number', () => {
    expect(previewNumber({ prefix: 'INV-{YY}-{CODE}-', next: 2630, digits: 4 }, d, 'TU')).toBe('INV-26-TU-2630');
    expect(previewNumber({ prefix: 'DC-', next: 7, digits: 5 }, d, '')).toBe('DC-00007');
  });
});
