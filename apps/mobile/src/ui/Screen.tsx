import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeTokens } from '../theme/ThemeProvider';

export interface ScreenProps {
  children: ReactNode;
  /** По умолчанию контент скроллится (используется pull-to-refresh). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = true, refreshing = false, onRefresh, contentStyle }: ScreenProps) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();

  if (!scroll) {
    return (
      <View
        style={[
          styles.flex,
          {
            backgroundColor: theme.colors.background,
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.lg,
            gap: theme.spacing.lg,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        {
          padding: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh === undefined ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        )
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
