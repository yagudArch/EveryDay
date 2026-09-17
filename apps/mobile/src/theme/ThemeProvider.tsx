import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { resolveTheme, resolveThemeMode, type ThemeMode, type ThemePreference, type ThemeTokens } from './tokens';

interface ThemeContextValue {
  tokens: ThemeTokens;
  mode: ThemeMode;
  preference: ThemePreference;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  /** preference из настроек пользователя (серверное значение), по умолчанию 'system'. */
  preference: ThemePreference;
  children: ReactNode;
}

export function ThemeProvider({ preference, children }: ThemeProviderProps) {
  const scheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const systemMode: ThemeMode | null = scheme === 'dark' || scheme === 'light' ? scheme : null;
    const mode = resolveThemeMode(preference, systemMode);
    return { tokens: resolveTheme(mode), mode, preference };
  }, [preference, scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useAppTheme должен вызываться внутри ThemeProvider.');
  }
  return value;
}

export function useThemeTokens(): ThemeTokens {
  return useAppTheme().tokens;
}

export function useThemeMode(): ThemeMode {
  return useAppTheme().mode;
}
