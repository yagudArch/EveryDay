import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useThemeTokens } from '../theme/ThemeProvider';
import type { ThemeTokens } from '../theme/tokens';
import { Button } from './Button';
import { Card, type CardTone } from './Card';

export function LoadingState({ label = 'Загрузка…' }: { label?: string }) {
  const theme = useThemeTokens();

  return (
    <Card tone="muted">
      <View style={[styles.row, { gap: theme.spacing.md }]} accessibilityRole="progressbar" accessibilityLabel={label}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {label}
        </Text>
      </View>
    </Card>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  detail?: string | null;
  retrying?: boolean;
}

export function ErrorState({ message, onRetry, detail = null, retrying = false }: ErrorStateProps) {
  const theme = useThemeTokens();

  return (
    <Card tone="danger" title="Не удалось загрузить данные">
      <Text
        accessibilityLiveRegion="polite"
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.typography.body.fontSize,
          lineHeight: theme.typography.body.lineHeight,
        }}
      >
        {message}
      </Text>

      {detail !== null && detail !== '' ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          {detail}
        </Text>
      ) : null}

      {onRetry !== undefined ? (
        <Button label="Повторить" variant="secondary" onPress={onRetry} loading={retrying} hint="Повторить запрос к backend" />
      ) : null}
    </Card>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  footnote?: string;
}

export function EmptyState({ title, description, footnote }: EmptyStateProps) {
  const theme = useThemeTokens();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.typography.bodyStrong.fontSize,
          lineHeight: theme.typography.bodyStrong.lineHeight,
          fontWeight: theme.typography.bodyStrong.fontWeight,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.body.fontSize,
          lineHeight: theme.typography.body.lineHeight,
        }}
      >
        {description}
      </Text>
      {footnote !== undefined ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

export type StatusTone = 'neutral' | 'primary' | 'warning' | 'danger';

function tonePalette(tone: StatusTone, theme: ThemeTokens): { background: string; text: string } {
  switch (tone) {
    case 'primary':
      return { background: theme.colors.surfaceMuted, text: theme.colors.primary };
    case 'warning':
      return { background: theme.colors.surfaceMuted, text: theme.colors.warning };
    case 'danger':
      return { background: theme.colors.surfaceMuted, text: theme.colors.danger };
    case 'neutral':
    default:
      return { background: theme.colors.surfaceMuted, text: theme.colors.textSecondary };
  }
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const theme = useThemeTokens();
  const palette = tonePalette(tone, theme);

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: palette.background,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
      ]}
    >
      <Text
        style={{
          color: palette.text,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: theme.typography.caption.lineHeight,
          fontWeight: theme.typography.bodyStrong.fontWeight,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useThemeTokens();

  return (
    <View style={[styles.row, { justifyContent: 'space-between', gap: theme.spacing.md }]}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: theme.typography.caption.lineHeight,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: theme.typography.caption.lineHeight,
          flexShrink: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export interface ModulePlaceholderProps {
  title: string;
  /** Этап, на котором модуль появится (из .ai/TASKS.md) или статус от backend. */
  stage: string;
  description: string;
  tone?: CardTone;
  statusLabel?: string;
}

/**
 * Честное состояние «модуль не реализован»: никаких примерных продуктов, погоды,
 * КБЖУ или рекомендаций-заглушек.
 */
export function ModulePlaceholder({
  title,
  stage,
  description,
  tone = 'default',
  statusLabel = 'не реализовано',
}: ModulePlaceholderProps) {
  const theme = useThemeTokens();

  return (
    <Card tone={tone}>
      <View style={[styles.row, { justifyContent: 'space-between', gap: theme.spacing.md }]}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.title.fontSize,
            lineHeight: theme.typography.title.lineHeight,
            fontWeight: theme.typography.title.fontWeight,
          }}
        >
          {title}
        </Text>
        <StatusPill label={statusLabel} tone="warning" />
      </View>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.body.fontSize,
          lineHeight: theme.typography.body.lineHeight,
        }}
      >
        {description}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: theme.typography.caption.lineHeight,
        }}
      >
        {stage}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { alignSelf: 'flex-start' },
});
