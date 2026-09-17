import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { normalizeEmail, validateLoginForm, type FieldErrors } from '../../features/auth/validation';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { Button, Card, Screen, TextField } from '../../ui';
import { errorMessage } from '../../utils/asyncState';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { login, busy, sessionNotice, clearSessionNotice } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    const validation = validateLoginForm({ email, password });
    setErrors(validation.errors);
    if (!validation.ok) return;

    setSubmitError(null);
    try {
      await login({ email: normalizeEmail(email), password });
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  };

  return (
    <Screen scroll>
      <Card
        title="Вход"
        subtitle="Приложение работает с реальным backend: сессия хранится в защищённом хранилище устройства."
      >
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          testID="login-email"
        />
        <TextField
          label="Пароль"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={() => {
            void submit();
          }}
          testID="login-password"
        />

        {submitError !== null ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: theme.colors.danger,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            }}
          >
            {submitError}
          </Text>
        ) : null}

        <Button
          label="Войти"
          onPress={() => {
            void submit();
          }}
          loading={busy}
          testID="login-submit"
        />
      </Card>

      {sessionNotice !== null ? (
        <Card tone="warning" title="Сессия завершена">
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            }}
          >
            {sessionNotice}
          </Text>
          <Button label="Понятно" variant="ghost" onPress={clearSessionNotice} />
        </Card>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Button label="Создать аккаунт" variant="secondary" onPress={() => navigation.navigate('Register')} />
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
            textAlign: 'center',
          }}
        >
          Пароль — минимум 12 символов. Пробный период Premium — 7 дней, платёжные сценарии пока не реализованы.
        </Text>
      </View>
    </Screen>
  );
}
