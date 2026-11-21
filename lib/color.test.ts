import { contrastRatio, readableOn } from './color';

describe('color helpers', () => {
  it('computes known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
  it('picks dark text on light colors and white on dark colors', () => {
    expect(readableOn('#E5A34B')).toBe('#171923');
    expect(readableOn('#6558F5')).toBe('#FFFFFF');
    expect(readableOn('#101116')).toBe('#FFFFFF');
  });
  it('always reaches at least 3:1 for every habit palette color', () => {
    const { habitPalette } = jest.requireActual('../theme/tokens') as typeof import('../theme/tokens');
    for (const c of habitPalette) expect(contrastRatio(readableOn(c), c)).toBeGreaterThanOrEqual(3);
  });
});
