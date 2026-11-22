import { levelForXp, levelProgress, xpForLevel } from './level';

describe('level math (mirrors server level_for_xp)', () => {
  it('matches the documented thresholds', () => {
    expect([0, 49, 50, 199, 200, 449, 450, 799, 800].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 50, 200, 450, 800]);
  });
  it('never goes negative or below level 1', () => {
    expect(levelForXp(-10)).toBe(1);
    expect(levelProgress(-5)).toMatchObject({ level: 1, xp: 0, fraction: 0 });
  });
  it('reports progress inside a level', () => {
    const p = levelProgress(125); // L2: 50..200
    expect(p).toMatchObject({ level: 2, levelStartXp: 50, nextLevelXp: 200 });
    expect(p.fraction).toBeCloseTo(0.5, 5);
  });
  it('level boundaries are consistent: xpForLevel(levelForXp(x)) <= x < xpForLevel(next)', () => {
    for (let x = 0; x < 5000; x += 7) {
      const l = levelForXp(x);
      expect(xpForLevel(l)).toBeLessThanOrEqual(x);
      expect(x).toBeLessThan(xpForLevel(l + 1));
    }
  });
});
