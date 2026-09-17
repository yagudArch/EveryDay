import { describe, expect, it } from 'vitest';

import { darkColors, lightColors, resolveTheme, resolveThemeMode, spacing, typography } from './tokens';

describe('resolveThemeMode', () => {
  it('уважает явный выбор пользователя', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('следует системе при preference=system', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
  });

  it('без системного значения использует light', () => {
    expect(resolveThemeMode('system', null)).toBe('light');
    expect(resolveThemeMode('system', undefined)).toBe('light');
  });
});

describe('resolveTheme', () => {
  it('отдаёт разные палитры для light и dark', () => {
    const light = resolveTheme('light');
    const dark = resolveTheme('dark');

    expect(light.colors).toBe(lightColors);
    expect(dark.colors).toBe(darkColors);
    expect(light.colors.background).not.toBe(dark.colors.background);
    expect(light.mode).toBe('light');
    expect(dark.mode).toBe('dark');
  });

  it('не оставляет незаполненных токенов', () => {
    const theme = resolveTheme('dark');
    const colors = Object.entries(theme.colors);
    expect(colors.length).toBeGreaterThan(10);
    for (const [key, value] of colors) {
      expect(`${key}:${value}`.length).toBeGreaterThan(key.length + 1);
    }
  });

  it('использует общие spacing/typography и доступный размер тапа', () => {
    const theme = resolveTheme('light');
    expect(theme.spacing).toBe(spacing);
    expect(theme.typography.body).toBe(typography.body);
    expect(theme.minTouchTarget).toBeGreaterThanOrEqual(44);
    expect(theme.spacing.xs).toBeLessThan(theme.spacing.lg);
  });
});
