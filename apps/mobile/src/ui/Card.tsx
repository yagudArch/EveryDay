import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useThemeTokens } from '../theme/ThemeProvider';

export type CardTone = 'default' | 'muted' | 'warning' | 'danger';

export interface CardProps {
  title?: string;
  subtitle?: string;
  tone?: CardTone;
  children?: ReactNode;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({ title, subtitle, tone = 'default', children, footer, style, testID }: CardProps) {
  const theme = useThemeTokens();

  const background = tone === 'muted' ? theme.colors.surfaceMuted : theme.colors.surface;
  const border =
    tone === 'warning' ? theme.colors.warning : tone === 'danger' ? theme.colors.danger : theme.colors.border;

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: background,
          borderColor: border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      {title !== undefined ? (
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
      ) : null}

      {subtitle !== undefined ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          {subtitle}
        </Text>
      ) : null}

      {children}

      {footer !== undefined ? <View style={{ marginTop: theme.spacing.sm }}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
