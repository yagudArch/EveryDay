import { UpdateDayContextSchema, type TodayContext } from '@everyday/contracts';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { apiBaseResolution, useApi } from '../api';
import { errorMessage } from '../utils/asyncState';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useAuth } from '../state/AuthContext';
import { usePreferences } from '../state/PreferencesContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Button, Card, ErrorState, LoadingState, ModulePlaceholder, Screen, StatusPill, TextField } from '../ui';
import { describeSubscription } from '../utils/subscription';
import { formatDateOnly, formatDateTime, greetingForHour } from '../utils/timezone';

interface ModuleSection {
  key: keyof TodayContext['modules'];
  title: string;
  stage: string;
  description: string;
}

/** Порядок и формулировки — только про реальные модули контракта, без выдуманных данных. */
const MODULE_SECTIONS: ModuleSection[] = [
  {
    key: 'nutrition',
    title: 'Питание',
    stage: 'Этап NUT-001…NUT-002 (следующий цикл работ)',
    description:
      'Дневник питания, цель по КБЖУ и приёмы пищи появятся после реализации backend-модуля питания. Сейчас API честно сообщает, что данных нет.',
  },
  {
    key: 'activity',
    title: 'Активность',
    stage: 'Этап ACT-001',
    description:
      'Шаги, тренировки и вес будут доступны после подключения HealthKit/Health Connect и ручного ввода. Разрешения на здоровье приложение сейчас не запрашивает.',
  },
  {
    key: 'weather',
    title: 'Погода и образ',
    stage: 'Этап WTH-001',
    description:
      'Прогноз и рекомендации по одежде появятся после подключения погодного сервиса и гардероба. Вымышленная погода не показывается.',
  },
  {
    key: 'wardrobe',
    title: 'Гардероб',
    stage: 'Этап WTH-001',
    description: 'Реальные вещи пользователя и абстрактные образы будут визуально различаться. Сейчас гардероб пуст.',
  },
  {
    key: 'inventory',
    title: 'Что есть дома',
    stage: 'Этап FOOD-001',
    description: 'Список продуктов дома появится после реализации модуля food_inventory.',
  },
  {
    key: 'shopping',
    title: 'Нужно купить',
    stage: 'Этап FOOD-001',
    description: 'Список покупок будет формироваться из рецептов, планов питания и остатков дома.',
  },
  {
    key: 'events',
    title: 'События и планы',
    stage: 'Этап DAY-001',
    description: 'Общий контекст дня появится после реализации событий и планов.',
  },
  {
    key: 'changes',
    title: 'Что изменилось',
    stage: 'Этап CHG-001',
    description: 'Смысловые изменения появятся после включения снапшотов и Change Detection.',
  },
];

export function HomeScreen() {
  const theme = useThemeTokens();
  const api = useApi();
  const { status: authStatus, profile, restoreError } = useAuth();
  const { preferences, serverBacked } = usePreferences();

  const resource = useAsyncResource<TodayContext>(() => api.todayContext(), {
    enabled: authStatus === 'authenticated',
  });
  const context = resource.state.data;

  const [noteDraft, setNoteDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const timezone = context?.timezone ?? preferences.timezone;
  const locale = preferences.locale;

  const startNoteEditing = () => {
    setNoteDraft(context?.dayNote ?? '');
    setNoteError(null);
    setEditingNote(true);
  };

  const saveNote = async () => {
    const trimmed = noteDraft.trim();
    const parsed = UpdateDayContextSchema.safeParse({ dayNote: trimmed === '' ? null : trimmed });
    if (!parsed.success) {
      setNoteError('Заметка не сохранена: превышена допустимая длина (2000 символов).');
      return;
    }

    setSavingNote(true);
    setNoteError(null);
    try {
      const updated = await api.updateDayNote(parsed.data);
      resource.setData(updated);
      setEditingNote(false);
    } catch (error) {
      setNoteError(errorMessage(error));
    } finally {
      setSavingNote(false);
    }
  };

  const subscription = context === null ? null : describeSubscription(context.subscription);

  return (
    <Screen
      refreshing={resource.state.status === 'refreshing'}
      onRefresh={resource.refresh}
    >
      <Card>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.display.fontSize,
            lineHeight: theme.typography.display.lineHeight,
            fontWeight: theme.typography.display.fontWeight,
          }}
        >
          {greetingForHour(new Date().getHours())}
          {profile === null ? '' : `, ${profile.displayName}`}
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {context === null ? 'Локальный день загружается…' : formatDateOnly(context.date, locale)}
        </Text>
        <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
          <StatusPill label={timezone} />
          {context?.preferences.city != null ? <StatusPill label={context.preferences.city} /> : null}
          {serverBacked ? null : <StatusPill label="настройки без сервера" tone="warning" />}
        </View>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          Контекст дня формируется backend по часовому поясу профиля (GET /api/v1/context/today).
        </Text>
      </Card>

      {restoreError !== null ? (
        <Card tone="warning" title="Профиль не проверен">
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            }}
          >
            {restoreError}
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
            }}
          >
            Сессия сохранена, данные обновятся после восстановления соединения.
          </Text>
        </Card>
      ) : null}

      {apiBaseResolution.ok && apiBaseResolution.warnings.length > 0
        ? apiBaseResolution.warnings.map((warning) => (
            <Card key={warning} tone="muted">
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.caption.fontSize,
                  lineHeight: theme.typography.caption.lineHeight,
                }}
              >
                {warning}
              </Text>
            </Card>
          ))
        : null}

      {subscription !== null ? (
        <Card title="Подписка" tone={subscription.requiresSubscription ? 'warning' : 'default'}>
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <StatusPill label={subscription.label} tone={subscription.premium ? 'primary' : 'warning'} />
            {subscription.daysLeft !== null ? <StatusPill label={`${subscription.daysLeft} дн.`} /> : null}
          </View>
          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            }}
          >
            {subscription.detail}
          </Text>
          {context !== null ? (
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
              }}
            >
              Пробный период до {formatDateTime(context.subscription.trialEndsAt, timezone, locale)}. Право доступа
              определяет сервер.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card title="Заметка дня">
        {editingNote ? (
          <View style={{ gap: theme.spacing.sm }}>
            <TextField
              label="Что важно сегодня"
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              numberOfLines={4}
              maxLength={2000}
              placeholder="Например: после работы тренировка, к ужину нужен белок"
              testID="day-note-input"
            />
            {noteError !== null ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  color: theme.colors.danger,
                  fontSize: theme.typography.caption.fontSize,
                  lineHeight: theme.typography.caption.lineHeight,
                }}
              >
                {noteError}
              </Text>
            ) : null}
            <View style={[styles.row, { gap: theme.spacing.sm }]}>
              <Button
                label="Сохранить"
                onPress={() => {
                  void saveNote();
                }}
                loading={savingNote}
                style={styles.flexButton}
                testID="day-note-save"
              />
              <Button
                label="Отмена"
                variant="ghost"
                onPress={() => setEditingNote(false)}
                disabled={savingNote}
                style={styles.flexButton}
              />
            </View>
          </View>
        ) : context?.dayNote != null ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              {context.dayNote}
            </Text>
            <Button label="Изменить" variant="secondary" onPress={startNoteEditing} />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              Заметка дня не заполнена. Она сохраняется на backend (PATCH /api/v1/context/today).
            </Text>
            <Button label="Добавить заметку" variant="secondary" onPress={startNoteEditing} disabled={context === null} />
          </View>
        )}
      </Card>

      <Card title="Быстрый голосовой ввод">
        <Button label="Сказать" disabled hint="Голосовой ввод появится на этапе NUT-005: микрофон пока не запрашивается" />
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          Голосовой ввод ещё не реализован. Приложение не запрашивает доступ к микрофону, не начинает запись при
          запуске и не отправляет аудио на сервер.
        </Text>
      </Card>

      {resource.state.status === 'loading' && context === null ? (
        <LoadingState label="Загружаем контекст дня…" />
      ) : resource.state.status === 'error' ? (
        <ErrorState
          message={resource.state.error ?? 'Не удалось загрузить контекст дня.'}
          onRetry={resource.reload}
        />
      ) : context !== null ? (
        <View style={{ gap: theme.spacing.lg }}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.title.fontSize,
              lineHeight: theme.typography.title.lineHeight,
              fontWeight: theme.typography.title.fontWeight,
            }}
          >
            Модули дня
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
            }}
          >
            Backend сообщает статус каждого модуля отдельно ({context.schemaVersion === 1 ? 'schemaVersion 1' : ''}).
            Пока данных нет — показывается «{context.modules.nutrition.status}», а не примерные значения.
          </Text>
          {MODULE_SECTIONS.map((section) => (
            <ModulePlaceholder
              key={section.key}
              title={section.title}
              stage={section.stage}
              description={section.description}
              statusLabel={context.modules[section.key].status === 'unavailable' ? 'нет данных' : context.modules[section.key].status}
            />
          ))}

          {context.memory.length > 0 ? (
            <Card title="Факты в памяти" subtitle="Только подтверждённые пользователем факты.">
              {context.memory.map((fact) => (
                <Text
                  key={fact.id}
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.body.fontSize,
                    lineHeight: theme.typography.body.lineHeight,
                  }}
                >
                  • {fact.fact}
                </Text>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flexButton: { flex: 1 },
});
