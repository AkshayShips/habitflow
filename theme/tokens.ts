/**
 * HabitFlow design tokens (Stage 2).
 * Palette follows the premium-redesign spec, with these deliberate deviations (checked with a WCAG script):
 *  - textSecondary is darker than the spec's #737987 (4.36:1 on white, 3.89:1 on the secondary surface = below AA).
 *  - success/warning/error colors from the spec fail AA as TEXT on light surfaces (2.2-3.4:1), so each has a
 *    "fill" (spec color; icons, bars, tints) and an "ink" (AA-safe; text, solid buttons with white text).
 *  - accentInk is a touch darker than accent for text on accentTint (4.27 -> AA).
 */

export const spacing = {
  xs: 4,
  sm: 8,
  sm2: 12,
  md: 16,
  md2: 20,
  lg: 24,
  xl: 32,
  xl2: 40,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
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
  /** Hairline divider. */
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  /** Accent for text on accentTint / surfaces (AA). */
  accentInk: string;
  accentTint: string;
  accentText: string;
  success: string;
  successInk: string;
  successTint: string;
  warning: string;
  warningInk: string;
  warningTint: string;
  /** Spec error color: fills/icons only. Use dangerInk for text and solid buttons. */
  danger: string;
  dangerInk: string;
  dangerTint: string;
  dangerText: string;
}

export const lightColors: ColorScheme = {
  bg: '#F8F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2F7',
  border: '#E8EAF0',
  text: '#171923',
  textSecondary: '#656B7B',
  accent: '#6558F5',
  accentInk: '#5548E0',
  accentTint: '#EFEDFF',
  accentText: '#FFFFFF',
  success: '#2FAD83',
  successInk: '#1B7F5E',
  successTint: '#E4F6EF',
  warning: '#E5A34B',
  warningInk: '#935F10',
  warningTint: '#FBF1E0',
  danger: '#DC6470',
  dangerInk: '#C0394B',
  dangerTint: '#FBE9EB',
  dangerText: '#FFFFFF',
};

export const darkColors: ColorScheme = {
  bg: '#101116',
  surface: '#1A1C24',
  surfaceAlt: '#242732',
  border: '#2E313D',
  text: '#F7F8FA',
  textSecondary: '#A0A5B2',
  accent: '#A69BFF',
  accentInk: '#A69BFF',
  accentTint: '#302C4B',
  accentText: '#101116',
  success: '#68D6AA',
  successInk: '#68D6AA',
  successTint: '#1D3A30',
  warning: '#F2C274',
  warningInk: '#F2C274',
  warningTint: '#3D3322',
  danger: '#F18E98',
  dangerInk: '#F18E98',
  dangerTint: '#3E2428',
  dangerText: '#101116',
};

/** Glyph/text color placed on tileColors or habit colors. */
export const onColor = '#FFFFFF';

/** Colored icon tiles in lists (settings, profile, stats). Same hues in both schemes; white glyph on top. */
export const tileColors = {
  orange: '#D9663F',
  purple: '#7A66E0',
  blue: '#4A7BE0',
  green: '#2E9E73',
  teal: '#2FA3B5',
  gold: '#C98A25',
  gray: '#6F7888',
} as const;

// Habit color choices offered in the habit editor.
export const habitPalette = [
  '#6558F5',
  '#2FAD83',
  '#E5A34B',
  '#D9728B',
  '#4A7BE0',
  '#2FA3B5',
  '#E07B5B',
  '#7A8696',
] as const;

/** Chrome behind the phone-width frame on desktop web (preview only). */
export const webFrameBg = '#15161C';
