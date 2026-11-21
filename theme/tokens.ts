/**
 * HabitFlow design tokens.
 * - 8pt grid: every spacing value is a multiple of 4, with 8 as the base unit.
 * - Colors are chosen to hit >= 4.5:1 contrast for body text on their background
 *   (text on bg, text on surface, accentText on accent) in BOTH schemes.
 * - Type scale follows iOS text styles so Dynamic Type scaling feels native.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface ColorScheme {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  dangerText: string;
}

// Calm palette: soft blue accent, no aggressive reds (the product is "calm, not guilt-driven").
export const lightColors: ColorScheme = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F4',
  border: '#D9DDE4',
  text: '#14171C', // on bg ~ 16:1
  textSecondary: '#566070', // on bg ~ 6:1
  accent: '#2F5FD0', // white on accent ~ 6.2:1
  accentText: '#FFFFFF',
  success: '#1F7A4D',
  warning: '#9A5B00',
  danger: '#B3261E',
  dangerText: '#FFFFFF',
};

export const darkColors: ColorScheme = {
  bg: '#0E1013',
  surface: '#171A1F',
  surfaceAlt: '#20242B',
  border: '#2C313A',
  text: '#F2F4F7', // on bg ~ 16:1
  textSecondary: '#A3ACB9', // on bg ~ 8:1
  accent: '#7EA2F5', // dark text on accent ~ 7:1
  accentText: '#0E1013',
  success: '#5CC995',
  warning: '#E0A44A',
  danger: '#F2766E',
  dangerText: '#0E1013',
};

// Habit color choices offered in the habit editor (Phase 2).
export const habitPalette = [
  '#5B8DEF',
  '#4FB286',
  '#E0A44A',
  '#D9728B',
  '#8E7CE0',
  '#4BB3C4',
  '#E07B5B',
  '#7A8696',
] as const;
