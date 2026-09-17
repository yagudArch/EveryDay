import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeTokens } from '../theme/ThemeProvider';
import { Button } from './Button';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Подтверждение в приложении (не Alert): работает одинаково на native и в web preview
 * и требует явного действия пользователя — используется для AI consent и logout.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useThemeTokens();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть диалог"
          style={styles.backdropPress}
          onPress={busy ? undefined : onCancel}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
            },
          ]}
        >
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

          <Text
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            }}
          >
            {message}
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              loading={busy}
              variant={destructive ? 'danger' : 'primary'}
            />
            <Button label={cancelLabel} onPress={onCancel} variant="ghost" disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropPress: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
  },
});
