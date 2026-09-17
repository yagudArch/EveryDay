import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from './src/AppShell';
import { AuthProvider } from './src/state/AuthContext';
import { PreferencesProvider } from './src/state/PreferencesContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PreferencesProvider>
          <AppShell />
        </PreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
