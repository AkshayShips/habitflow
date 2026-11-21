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
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.4 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.4 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.4 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.3 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.1 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0 },
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
  bg: '#F2F2F7', // iOS grouped background
  surface: '#FFFFFF',
  surfaceAlt: '#E9E9EE',
  border: '#DCDCE1',
  text: '#0A0A0C', // on bg ~ 17:1
  textSecondary: '#66666B', // on bg ~ 5:1, on surface ~ 5.6:1
  accent: '#2F5FD0', // white on accent ~ 6.2:1
  accentText: '#FFFFFF',
  success: '#1F7A4D',
  warning: '#9A5B00',
  danger: '#B3261E',
  dangerText: '#FFFFFF',
};

export const darkColors: ColorScheme = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  border: '#38383A',
  text: '#F5F5F7', // ~ 18:1
  textSecondary: '#A1A1A6', // on surface ~ 6.6:1
  accent: '#7EA2F5', // dark text on accent ~ 8:1
  accentText: '#000000',
  success: '#5CC995',
  warning: '#E0A44A',
  danger: '#F2766E',
  dangerText: '#000000',
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
