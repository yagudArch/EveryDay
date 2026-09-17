import { UpdatePreferencesSchema, type Subscription, type UpdatePreferencesInput } from '@everyday/contracts';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { apiBaseResolution, tokenStorage, useApi } from '../api';
import { getSessionExpiresAtMs } from '../api/session';
import { APP_NAME, APP_VERSION, DEV_APPLICATION_ID } from '../config/appInfo';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useAuth } from '../state/AuthContext';
import { usePreferences } from '../state/PreferencesContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import type { ThemePreference } from '../theme/tokens';
import { Button, Card, ConfirmDialog, ErrorState, InfoRow, LoadingState, Screen, StatusPill, TextField } from '../ui';
import { errorMessage } from '../utils/asyncState';
import { describeSubscription } from '../utils/subscription';
import { validateTimezoneValue } from '../features/auth/validation';
import { deviceTimezone, formatDateTime } from '../utils/timezone';

interface Feedback {
  tone: 'info' | 'error';
  message: string;
}

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

function OptionButtons<T extends string>({
  options,
  selected,
  onSelect,
  disabled = false,
}: {
  options: SelectOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.options}>
      {options.map((option) => (
        <Button
          key={option.value}
          label={option.label}
          variant={option.value === selected ? 'primary' : 'secondary'}
          onPress={() => onSelect(option.value)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

export function SettingsScreen() {
  const theme = useThemeTokens();
  const api = useApi();
  const { profile, logout, updateDisplayName } = useAuth();
  const {
    preferences,
    serverBacked,
    status: preferencesStatus,
    error: preferencesError,
    saving,
    reload,
    save,
  } = usePreferences();

  const subscriptionResource = useAsyncResource<Subscription>(() => api.subscription());

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [city, setCity] = useState(preferences.city ?? '');
  const [timezone, setTimezone] = useState(preferences.timezone);
  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [consentVisible, setConsentVisible] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
  }, [profile?.displayName]);

  useEffect(() => {
    setCity(preferences.city ?? '');
    setTimezone(preferences.timezone);
  }, [preferences.city, preferences.timezone]);

  const persist = async (patch: UpdatePreferencesInput, successMessage: string) => {
    const parsed = UpdatePreferencesSchema.safeParse(patch);
    if (!parsed.success) {
      setFeedback({ tone: 'error', message: 'Значения не отправлены: они не соответствуют контракту настроек.' });
      return;
    }
    setFeedback(null);
    try {
      await save(parsed.data);
      setFeedback({ tone: 'info', message: successMessage });
    } catch (error) {
      setFeedback({ tone: 'error', message: errorMessage(error) });
    }
  };

  const saveProfile = async () => {
    setFeedback(null);
    setSavingProfile(true);
    try {
      await updateDisplayName(displayName);
      setFeedback({ tone: 'info', message: 'Имя сохранено.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: errorMessage(error) });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveTimezone = async () => {
    const timezoneError = validateTimezoneValue(timezone);
    if (timezoneError !== null) {
      setFeedback({ tone: 'error', message: timezoneError });
      return;
    }
    await persist({ timezone: timezone.trim() }, 'Часовой пояс сохранён.');
  };

  const sessionExpiryMs = getSessionExpiresAtMs();
  const subscriptionData: Subscription | null = subscriptionResource.state.data;
  // Сводка строится только из реального ответа сервера: без данных ничего не показывается.
  const subscriptionSummary = subscriptionData === null ? null : describeSubscription(subscriptionData);

  return (
    <Screen>
      {feedback !== null ? (
        <Card tone={feedback.tone === 'error' ? 'danger' : 'muted'}>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: feedback.tone === 'error' ? theme.colors.danger : theme.colors.textPrimary,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            }}
          >
            {feedback.message}
          </Text>
        </Card>
      ) : null}

      <Card title="Профиль" subtitle="Изменения сохраняются на backend (PATCH /api/v1/me).">
        <InfoRow label="Email" value={profile?.email ?? 'не загружен'} />
        <TextField label="Имя" value={displayName} onChangeText={setDisplayName} maxLength={80} testID="settings-display-name" />
        <Button
          label="Сохранить имя"
          onPress={() => {
            void saveProfile();
          }}
          loading={savingProfile}
          disabled={displayName.trim() === ''}
          hint="Имя не может быть пустым"
        />
        <InfoRow
          label="Аккаунт создан"
          value={profile === null ? '—' : formatDateTime(profile.createdAt, preferences.timezone, preferences.locale)}
        />
      </Card>

      <Card title="Подписка" subtitle="Право доступа определяет сервер; платёжные сценарии пока не реализованы.">
        {subscriptionResource.state.status === 'loading' && subscriptionResource.state.data === null ? (
          <LoadingState label="Проверяем подписку…" />
        ) : subscriptionResource.state.status === 'error' ? (
          <ErrorState
            message={subscriptionResource.state.error ?? 'Не удалось получить данные подписки.'}
            onRetry={subscriptionResource.reload}
          />
        ) : subscriptionSummary !== null ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={styles.pills}>
              <StatusPill label={subscriptionSummary.label} tone={subscriptionSummary.premium ? 'primary' : 'warning'} />
              {subscriptionSummary.daysLeft !== null ? (
                <StatusPill label={`${subscriptionSummary.daysLeft} дн.`} />
              ) : null}
            </View>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              {subscriptionSummary.detail}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card title="Приложение">
        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Тема</Text>
        <OptionButtons<ThemePreference>
          options={[
            { value: 'system', label: 'Как в системе' },
            { value: 'light', label: 'Светлая' },
            { value: 'dark', label: 'Тёмная' },
          ]}
          selected={preferences.theme}
          onSelect={(value) => {
            void persist({ theme: value }, 'Тема сохранена.');
          }}
          disabled={saving}
        />

        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Локаль</Text>
        <OptionButtons<'ru' | 'en'>
          options={[
            { value: 'ru', label: 'Русский' },
            { value: 'en', label: 'English' },
          ]}
          selected={preferences.locale}
          onSelect={(value) => {
            void persist({ locale: value }, 'Локаль сохранена.');
          }}
          disabled={saving}
        />
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          Локаль влияет на форматирование дат. Полная локализация интерфейса появится на этапе POLISH.
        </Text>

        <TextField
          label="Часовой пояс (IANA)"
          value={timezone}
          onChangeText={setTimezone}
          autoCapitalize="none"
          helper="Сервер рассчитывает локальный день по этому значению."
          testID="settings-timezone"
        />
        <View style={styles.actions}>
          <Button
            label="Сохранить часовой пояс"
            variant="secondary"
            onPress={() => {
              void saveTimezone();
            }}
            disabled={saving}
            style={styles.flex}
          />
          <Button
            label="Как на устройстве"
            variant="ghost"
            onPress={() => setTimezone(deviceTimezone())}
            disabled={saving}
            style={styles.flex}
          />
        </View>

        <TextField
          label="Город"
          value={city}
          onChangeText={setCity}
          placeholder="Например: Riga"
          maxLength={120}
          testID="settings-city"
        />
        <View style={styles.actions}>
          <Button
            label="Сохранить город"
            variant="secondary"
            onPress={() => {
              const trimmed = city.trim();
              void persist({ city: trimmed === '' ? null : trimmed }, 'Город сохранён.');
            }}
            disabled={saving}
            style={styles.flex}
          />
          <Button
            label="Очистить"
            variant="ghost"
            onPress={() => {
              setCity('');
              void persist({ city: null }, 'Город удалён.');
            }}
            disabled={saving}
            style={styles.flex}
          />
        </View>
      </Card>

      <Card title="Приватность" subtitle="Согласие на внешний AI по умолчанию не выдано.">
        <View style={styles.pills}>
          <StatusPill
            label={preferences.aiConsent ? 'внешний AI разрешён' : 'внешний AI запрещён'}
            tone={preferences.aiConsent ? 'primary' : 'warning'}
          />
        </View>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          Внешний AI-провайдер сейчас не подключён, поэтому запросы не выполняются независимо от согласия. Если
          согласие выдано и провайдер появится, ваши тексты будут отправляться ему для разбора.
        </Text>

        {preferences.aiConsent ? (
          <Button
            label="Отозвать согласие"
            variant="danger"
            onPress={() => {
              void persist({ aiConsent: false }, 'Согласие отозвано.');
            }}
            disabled={saving}
          />
        ) : (
          <Button
            label="Разрешить внешний AI"
            variant="secondary"
            onPress={() => setConsentVisible(true)}
            disabled={saving}
            hint="Потребуется явное подтверждение"
          />
        )}

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              Память AI
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
              }}
            >
              Управление фактами памяти появится на этапе BCK-002; сейчас сохраняется только флаг согласия.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Память AI"
            value={preferences.memoryEnabled}
            disabled={saving}
            onValueChange={(value) => {
              void persist({ memoryEnabled: value }, value ? 'Память включена.' : 'Память выключена.');
            }}
          />
        </View>
      </Card>

      <Card title="Ограничения и аллергии" subtitle="Редактирование появится вместе с модулем питания (NUT-002).">
        <InfoRow
          label="Ограничения"
          value={preferences.dietaryRestrictions.length === 0 ? 'не заданы' : preferences.dietaryRestrictions.join(', ')}
        />
        <InfoRow label="Аллергии" value={preferences.allergies.length === 0 ? 'не заданы' : preferences.allergies.join(', ')} />
      </Card>

      <Card title="Диагностика">
        <InfoRow
          label="API"
          value={
            apiBaseResolution.ok
              ? `${apiBaseResolution.baseUrl} (${apiBaseResolution.source})`
              : `ошибка конфигурации: ${apiBaseResolution.reason}`
          }
        />
        <InfoRow
          label="Хранилище сессии"
          value={tokenStorage.persistent ? tokenStorage.kind : `${tokenStorage.kind} (не сохраняется между запусками)`}
        />
        <InfoRow
          label="Сессия истекает"
          value={
            sessionExpiryMs === null
              ? 'время не получено от сервера'
              : formatDateTime(new Date(sessionExpiryMs).toISOString(), preferences.timezone, preferences.locale)
          }
        />
        <InfoRow label="Настройки" value={serverBacked ? 'загружены с backend' : 'локальные дефолты'} />
        <InfoRow label="Версия" value={`${APP_NAME} ${APP_VERSION}`} />
        <InfoRow label="Идентификатор сборки" value={DEV_APPLICATION_ID} />
        {preferencesStatus === 'error' && preferencesError !== null ? (
          <View style={{ gap: theme.spacing.sm }}>
            <InfoRow label="Ошибка настроек" value={preferencesError} />
            <Button label="Перечитать настройки" variant="secondary" onPress={reload} />
          </View>
        ) : null}
      </Card>

      <Card title="Аккаунт">
        <Button
          label="Выйти из аккаунта"
          variant="danger"
          onPress={() => setLogoutVisible(true)}
          hint="Сессия будет отозвана и удалена из защищённого хранилища"
        />
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          Выход очищает токен на устройстве даже если сервер недоступен.
        </Text>
      </Card>

      <ConfirmDialog
        visible={consentVisible}
        title="Разрешить отправку данных во внешний AI?"
        message="Тексты, которые вы вводите для разбора, будут отправлены внешнему AI-провайдеру. Данные питания, сна и местоположения автоматически не отправляются. Согласие можно отозвать в любой момент."
        confirmLabel="Разрешаю"
        cancelLabel="Отмена"
        onConfirm={() => {
          setConsentVisible(false);
          void persist({ aiConsent: true }, 'Согласие сохранено.');
        }}
        onCancel={() => setConsentVisible(false)}
      />

      <ConfirmDialog
        visible={logoutVisible}
        title="Выйти из аккаунта?"
        message="Локальная сессия будет удалена, контекст пользователя очищен. Данные на сервере останутся без изменений."
        confirmLabel="Выйти"
        cancelLabel="Остаться"
        destructive
        onConfirm={() => {
          setLogoutVisible(false);
          void logout();
        }}
        onCancel={() => setLogoutVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600' },
  flex: { flexGrow: 1, flexBasis: 160 },
});
