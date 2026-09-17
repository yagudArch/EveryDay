import { Text } from 'react-native';

import type { ApiBaseFailure } from '../config/apiBase';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Card, Screen } from '../ui';

/**
 * Показывается вместо приложения, если адрес backend задан неверно.
 * Приложение не подставляет «какой-нибудь» URL и не работает с выдуманным API.
 */
export function ConfigErrorScreen({ resolution }: { resolution: ApiBaseFailure }) {
  const theme = useThemeTokens();

  return (
    <Screen scroll>
      <Card tone="danger" title="Нужна настройка API">
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {resolution.message}
        </Text>
      </Card>

      <Card title="Как исправить">
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {'1. Задайте переменную EXPO_PUBLIC_API_URL в apps/mobile/.env (см. .env.example).'}
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {'2. Укажите только origin, без /api/v1: путь добавляется из packages/contracts.'}
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {'3. Android emulator: http://10.0.2.2:3000, iOS simulator и web: http://localhost:3000.'}
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {'4. Для production сборки адрес обязателен и должен быть HTTPS.'}
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          Код причины: {resolution.reason}. После изменения .env перезапустите dev server.
        </Text>
      </Card>
    </Screen>
  );
}
