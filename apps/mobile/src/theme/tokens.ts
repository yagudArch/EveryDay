/**
 * Design tokens: единый источник цветов/отступов/типографики для light и dark.
 * Чистый TS — покрыт unit-тестами; React-часть в ThemeProvider.
 */

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;
  info: string;
  overlay: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
}

export interface ThemeTypography {
  caption: TextStyle;
  body: TextStyle;
  bodyStrong: TextStyle;
  title: TextStyle;
  display: TextStyle;
}

export interface ThemeTokens {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  typography: ThemeTypography;
  /** Минимальная зона нажатия для доступности. */
  minTouchTarget: number;
}

export const spacing: ThemeSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius: ThemeRadius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const typography: ThemeTypography = {
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
};

export const lightColors: ThemeColors = {
  background: '#F5F7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF1F2',
  border: '#DCE2E4',
  textPrimary: '#11171A',
  textSecondary: '#465054',
  textMuted: '#6C767A',
  textOnPrimary: '#FFFFFF',
  primary: '#1B7F5B',
  primaryPressed: '#146148',
  accent: '#0F6C74',
  danger: '#B3261E',
  success: '#1B7F5B',
  warning: '#8A6100',
  info: '#1F5F8B',
  overlay: 'rgba(10, 14, 16, 0.45)',
};

export const darkColors: ThemeColors = {
  background: '#0E1315',
  surface: '#171D20',
  surfaceMuted: '#1F272A',
  border: '#2C3639',
  textPrimary: '#F1F4F5',
  textSecondary: '#C3CBD0',
  textMuted: '#8D979C',
  textOnPrimary: '#06231A',
  primary: '#43B389',
  primaryPressed: '#5CC79C',
  accent: '#63C7C0',
  danger: '#F2B8B5',
  success: '#7BD3AA',
  warning: '#E7C36A',
  info: '#8FC3E8',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export function resolveThemeMode(
  preference: ThemePreference,
  systemMode: ThemeMode | null | undefined,
): ThemeMode {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemMode === 'dark' ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): ThemeTokens {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    minTouchTarget: 48,
  };
}
