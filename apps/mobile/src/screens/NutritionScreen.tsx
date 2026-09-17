import type { TodayContext } from '@everyday/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { useApi } from '../api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useAuth } from '../state/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Card, ErrorState, LoadingState, ModulePlaceholder, Screen, StatusPill } from '../ui';

/**
 * Питание — следующий приоритет продукта, но модуль ещё не реализован.
 * Экран не подменяет backend: он показывает только реальные цели из контекста дня
 * (если они есть) и честное состояние «данных нет».
 */
export function NutritionScreen() {
  const theme = useThemeTokens();
  const api = useApi();
  const { status: authStatus } = useAuth();

  const resource = useAsyncResource<TodayContext>(() => api.todayContext(), {
    enabled: authStatus === 'authenticated',
  });
  const context = resource.state.data;

  return (
    <Screen refreshing={resource.state.status === 'refreshing'} onRefresh={resource.refresh}>
      <Card
        title="Питание"
        subtitle="Главный модуль продукта. Пока backend не отдаёт ни одного приёма пищи, экран не показывает примерные калории или продукты."
      >
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <StatusPill label="дневник: нет данных" tone="warning" />
          <StatusPill label="КБЖУ: нет данных" tone="warning" />
        </View>
      </Card>

      {resource.state.status === 'loading' && context === null ? (
        <LoadingState label="Проверяем цели питания на сервере…" />
      ) : resource.state.status === 'error' ? (
        <ErrorState message={resource.state.error ?? 'Не удалось загрузить контекст дня.'} onRetry={resource.reload} />
      ) : context !== null && context.goals.length > 0 ? (
        <Card title="Цели питания" subtitle="Реальные значения с backend.">
          {context.goals.map((goal) => (
            <Text
              key={goal.id}
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              • {goal.type}: {goal.calories === null ? '—' : `${goal.calories} kcal`},{' '}
              {goal.protein === null ? '—' : `${goal.protein} g белка`}
            </Text>
          ))}
        </Card>
      ) : (
        <Card tone="muted" title="Цель питания не задана">
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            }}
          >
            Настроить цель (поддержание/снижение/набор веса или свои КБЖУ) можно будет вместе с модулем питания.
          </Text>
        </Card>
      )}

      <ModulePlaceholder
        title="Дневник приёмов пищи"
        stage="Этап NUT-001 (backend) → NUT-002 (этот экран)"
        description="Добавление блюда текстом, повтор предыдущего приёма пищи, фото и штрихкод появятся после реализации нормализованных meals/nutrition_entries. Приложение не подставляет ничего вместо реальных данных."
      />
      <ModulePlaceholder
        title="Голосовой ввод еды"
        stage="Этап NUT-005"
        description="Голосовой ввод появится после готовности текстового парсинга и подтверждения действий. Микрофон не запрашивается."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
