import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useThemeTokens } from '../theme/ThemeProvider';
import type { ThemeTokens } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  /** Не обязателен для disabled-кнопок (например, «Сказать» до этапа NUT-005). */
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** accessibilityHint: объясняет последствие действия (в т.ч. почему кнопка недоступна). */
  hint?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface VariantColors {
  background: string;
  text: string;
  border: string;
}

function variantColors(variant: ButtonVariant, theme: ThemeTokens): VariantColors {
  switch (variant) {
    case 'primary':
      return { background: theme.colors.primary, text: theme.colors.textOnPrimary, border: 'transparent' };
    case 'secondary':
      return { background: theme.colors.surfaceMuted, text: theme.colors.textPrimary, border: theme.colors.border };
    case 'danger':
      return { background: 'transparent', text: theme.colors.danger, border: theme.colors.danger };
    case 'ghost':
    default:
      return { background: 'transparent', text: theme.colors.primary, border: 'transparent' };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  hint,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const theme = useThemeTokens();
  const palette = variantColors(variant, theme);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
          borderRadius: theme.radius.md,
          minHeight: theme.minTouchTarget,
          paddingHorizontal: theme.spacing.lg,
          opacity: inactive ? 0.55 : 1,
          transform: [{ scale: pressed && !inactive ? 0.99 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: palette.text,
              fontSize: theme.typography.bodyStrong.fontSize,
              lineHeight: theme.typography.bodyStrong.lineHeight,
              fontWeight: theme.typography.bodyStrong.fontWeight,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    textAlign: 'center',
  },
});
