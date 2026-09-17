import { StatusBar } from 'expo-status-bar';

import { apiBaseResolution } from './api';
import { RootNavigator } from './navigation/RootNavigator';
import { ConfigErrorScreen } from './screens/ConfigErrorScreen';
import { usePreferences } from './state/PreferencesContext';
import { ThemeProvider, useThemeMode } from './theme/ThemeProvider';
import type { ThemePreference } from './theme/tokens';

/**
 * Тема берётся из серверных preferences (theme), поэтому ThemeProvider находится
 * внутри PreferencesProvider. Пока настройки не загружены, действует 'system'.
 */
export function AppShell() {
  const { preferences } = usePreferences();
  const preference: ThemePreference = preferences.theme;

  return (
    <ThemeProvider preference={preference}>
      <ThemedContent />
    </ThemeProvider>
  );
}

function ThemedContent() {
  const mode = useThemeMode();

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {apiBaseResolution.ok ? <RootNavigator /> : <ConfigErrorScreen resolution={apiBaseResolution} />}
    </>
  );
}
