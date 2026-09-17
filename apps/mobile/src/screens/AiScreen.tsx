import type { ActionPreview, AIStatus } from '@everyday/contracts';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError, useApi } from '../api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useAuth } from '../state/AuthContext';
import { usePreferences } from '../state/PreferencesContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, StatusPill, TextField } from '../ui';
import { errorMessage } from '../utils/asyncState';

const CAPABILITY_LABELS: Record<string, string> = {
  text: 'текст',
  vision: 'изображения',
  speech_to_text: 'распознавание речи',
  structured_output: 'структурированный вывод',
  embeddings: 'embeddings',
  tools: 'tools',
};

export function AiScreen() {
  const theme = useThemeTokens();
  const api = useApi();
  const { status: authStatus } = useAuth();
  const { preferences } = usePreferences();

  const statusResource = useAsyncResource<AIStatus>(() => api.aiStatus(), {
    enabled: authStatus === 'authenticated',
  });
  const aiStatus = statusResource.state.data;
  const providerReady = aiStatus !== null && aiStatus.configured;

  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const runPreview = async () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      setPreview(null);
      setPreviewError('Введите текст, чтобы проверить разбор.');
      setPreviewCode(null);
      return;
    }

    setPreviewing(true);
    setPreviewError(null);
    setPreviewCode(null);
    try {
      const result = await api.aiParse(trimmed);
      setPreview(result);
    } catch (error) {
      setPreview(null);
      setPreviewError(errorMessage(error));
      setPreviewCode(error instanceof ApiError ? error.code : null);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Screen>
      <Card
        title="AI-помощник"
        subtitle="Разбор текста и preview действий. AI не является отдельным чатом: он работает с реальными данными приложения."
      >
        {statusResource.state.status === 'loading' && aiStatus === null ? (
          <LoadingState label="Проверяем статус AI на сервере…" />
        ) : statusResource.state.status === 'error' ? (
          <ErrorState
            message={statusResource.state.error ?? 'Не удалось получить статус AI.'}
            onRetry={statusResource.reload}
          />
        ) : aiStatus !== null ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
              <StatusPill label={`провайдер: ${aiStatus.provider}`} />
              <StatusPill
                label={aiStatus.configured ? 'подключён' : 'не подключён'}
                tone={aiStatus.configured ? 'primary' : 'warning'}
              />
            </View>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              Возможности:{' '}
              {aiStatus.capabilities.length === 0
                ? 'нет доступных возможностей'
                : aiStatus.capabilities.map((capability) => CAPABILITY_LABELS[capability] ?? capability).join(', ')}
              .
            </Text>
            {providerReady ? null : (
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.body.fontSize,
                  lineHeight: theme.typography.body.lineHeight,
                }}
              >
                Внешний AI-провайдер не подключён. Запросы не выполняются, ответы не выдумываются: запрос разбора
                вернёт честную ошибку сервиса.
              </Text>
            )}
          </View>
        ) : null}
      </Card>

      <Card title="Согласие на внешний AI">
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <StatusPill
            label={preferences.aiConsent ? 'согласие выдано' : 'согласие не выдано'}
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
          По умолчанию согласие не выдано. Изменить его можно в настройках; никакие данные не отправляются внешнему
          провайдеру до явного согласия.
        </Text>
      </Card>

      <Card title="Проверка текста (preview)">
        <TextField
          label="Что произошло"
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={3}
          maxLength={4000}
          placeholder="Например: на завтрак овсянка и два яйца, вечером тренировка"
          testID="ai-parse-input"
        />
        <Button
          label="Разобрать (без сохранения)"
          onPress={() => {
            void runPreview();
          }}
          loading={previewing}
          testID="ai-parse-submit"
        />
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          Preview ничего не сохраняет: применение действий появится после этапа NUT-004 и требует подтверждения
          пользователя.
        </Text>

        {previewError !== null ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.danger,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
              }}
            >
              {previewError}
            </Text>
            {previewCode !== null ? (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.typography.caption.fontSize,
                  lineHeight: theme.typography.caption.lineHeight,
                }}
              >
                Код ошибки backend: {previewCode}
              </Text>
            ) : null}
          </View>
        ) : null}

        {preview !== null ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.bodyStrong.fontSize,
                lineHeight: theme.typography.bodyStrong.lineHeight,
                fontWeight: theme.typography.bodyStrong.fontWeight,
              }}
            >
              Я правильно понял?
            </Text>

            {preview.clarification !== null ? (
              <Text
                style={{
                  color: theme.colors.warning,
                  fontSize: theme.typography.body.fontSize,
                  lineHeight: theme.typography.body.lineHeight,
                }}
              >
                {preview.clarification}
              </Text>
            ) : null}

            {preview.actions.length === 0 ? (
              <EmptyState
                title="Действий не найдено"
                description="Провайдер вернул пустой список действий. Ничего не сохранено."
              />
            ) : (
              preview.actions.map((action) => (
                <View
                  key={action.id}
                  style={{
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                    borderRadius: theme.radius.md,
                    padding: theme.spacing.md,
                    gap: theme.spacing.xs,
                  }}
                >
                  <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
                    <StatusPill label={action.type} tone="primary" />
                    <StatusPill label={`модуль: ${action.module}`} />
                  </View>
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: theme.typography.caption.fontSize,
                      lineHeight: theme.typography.caption.lineHeight,
                    }}
                  >
                    {JSON.stringify(action.parameters)}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.typography.caption.fontSize,
                      lineHeight: theme.typography.caption.lineHeight,
                    }}
                  >
                    confidence {action.confidence.toFixed(2)}
                    {action.occurredAt === null ? '' : `, время: ${action.occurredAt}`} · требует подтверждения
                  </Text>
                </View>
              ))
            )}

            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
              }}
            >
              Это только предпросмотр: данные не применены и не сохранены.
            </Text>
          </View>
        ) : null}
      </Card>

      <Card title="Голосовой ввод">
        <Button
          label="Сказать"
          disabled
          hint="Голосовой ввод ещё не реализован: микрофон не запрашивается"
        />
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          Голосовой ввод включится только по явному действию пользователя и только после этапа NUT-005. Сейчас аудио не
          записывается, не хранится и не отправляется: зависимостей для записи звука в приложении нет.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
