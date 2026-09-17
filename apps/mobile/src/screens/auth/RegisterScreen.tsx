import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  passwordHint,
  validateRegisterForm,
  type FieldErrors,
} from '../../features/auth/validation';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../state/AuthContext';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { Button, Card, Screen, TextField } from '../../ui';
import { errorMessage } from '../../utils/asyncState';
import { deviceTimezone } from '../../utils/timezone';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const theme = useThemeTokens();
  const { register, busy } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(() => deviceTimezone());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    const validation = validateRegisterForm({ email, password, displayName, timezone });
    setErrors(validation.errors);
    if (!validation.ok) return;

    setSubmitError(null);
    try {
      await register(validation.value);
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  };

  return (
    <Screen scroll>
      <Card
        title="Регистрация"
        subtitle="Аккаунт создаётся на backend этого проекта. Данные о питании, погоде и активности появятся только после реализации соответствующих модулей."
      >
        <TextField
          label="Имя"
          value={displayName}
          onChangeText={setDisplayName}
          error={errors.displayName}
          placeholder="Как к вам обращаться"
          autoCapitalize="words"
          autoComplete="name"
          testID="register-display-name"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          testID="register-email"
        />
        <TextField
          label="Пароль"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          helper={passwordHint(password)}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          maxLength={128}
          testID="register-password"
          accessibilityHint={`Минимальная длина пароля ${PASSWORD_MIN_LENGTH} символов`}
        />
        <TextField
          label="Часовой пояс (IANA)"
          value={timezone}
          onChangeText={setTimezone}
          error={errors.timezone}
          helper="Определён по устройству. Используется сервером для расчёта локального дня."
          autoCapitalize="none"
          testID="register-timezone"
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
          label="Создать аккаунт"
          onPress={() => {
            void submit();
          }}
          loading={busy}
          testID="register-submit"
        />
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Button label="У меня уже есть аккаунт" variant="secondary" onPress={() => navigation.navigate('Login')} />
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
            textAlign: 'center',
          }}
        >
          Разрешения микрофона, геолокации и здоровья приложение не запрашивает.
        </Text>
      </View>
    </Screen>
  );
}
