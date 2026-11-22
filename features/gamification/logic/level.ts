/**
 * Mirrors the server's public.level_for_xp(): level n starts at 50*(n-1)^2 XP
 * (L2=50, L3=200, L4=450, L5=800, ...). The server is the source of truth; this is only for display.
 */
export const levelForXp = (xp: number): number => 1 + Math.floor(Math.sqrt(Math.max(xp, 0) / 50));
export const xpForLevel = (level: number): number => 50 * (Math.max(level, 1) - 1) ** 2;

export interface LevelProgress {
  level: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number;
  /** 0..1 within the current level. */
  fraction: number;
}

export function levelProgress(xp: number): LevelProgress {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelForXp(safe);
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  return { level, xp: safe, levelStartXp, nextLevelXp, fraction: (safe - levelStartXp) / (nextLevelXp - levelStartXp) };
}
