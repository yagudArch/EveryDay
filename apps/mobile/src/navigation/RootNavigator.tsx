import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAuth } from '../state/AuthContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { LoadingState, Screen } from '../ui';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status } = useAuth();
  const { tokens, mode } = useAppTheme();

  const navigationTheme = useMemo<Theme>(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: tokens.colors.primary,
        background: tokens.colors.background,
        card: tokens.colors.surface,
        text: tokens.colors.textPrimary,
        border: tokens.colors.border,
        notification: tokens.colors.danger,
      },
    };
  }, [mode, tokens]);

  if (status === 'restoring') {
    return (
      <Screen scroll={false}>
        <LoadingState label="Проверяем сохранённую сессию…" />
      </Screen>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: tokens.colors.surface },
          headerTintColor: tokens.colors.textPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: tokens.colors.background },
        }}
      >
        {status === 'authenticated' ? (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={({ navigation }) => ({
                title: 'Каждый день',
                headerRight: () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Настройки"
                    accessibilityHint="Открыть профиль, тему, приватность и выход из аккаунта"
                    onPress={() => navigation.navigate('Settings')}
                    hitSlop={12}
                    style={styles.headerButton}
                  >
                    <Text
                      style={{
                        color: tokens.colors.primary,
                        fontSize: tokens.typography.bodyStrong.fontSize,
                        fontWeight: tokens.typography.bodyStrong.fontWeight,
                      }}
                    >
                      Настройки
                    </Text>
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Регистрация' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: { paddingHorizontal: 4, paddingVertical: 4 },
});
