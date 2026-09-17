import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useThemeTokens } from '../theme/ThemeProvider';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  secureTextEntry?: boolean;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  keyboardType?: TextInputProps['keyboardType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  testID?: string;
  accessibilityHint?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error = null,
  secureTextEntry = false,
  editable = true,
  multiline = false,
  numberOfLines,
  maxLength,
  autoCapitalize = 'sentences',
  autoCorrect = false,
  autoComplete,
  keyboardType = 'default',
  returnKeyType,
  onSubmitEditing,
  testID,
  accessibilityHint,
}: TextFieldProps) {
  const theme = useThemeTokens();
  const hasError = error !== null && error !== '';

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: theme.typography.caption.lineHeight,
          fontWeight: theme.typography.caption.fontWeight,
        }}
      >
        {label}
      </Text>

      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint ?? (hasError ? error : helper)}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        editable={editable}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          {
            color: theme.colors.textPrimary,
            backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceMuted,
            borderColor: hasError ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
            minHeight: multiline ? theme.minTouchTarget * 2 : theme.minTouchTarget,
          },
        ]}
      />

      {hasError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: theme.colors.danger,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : helper !== undefined ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
  },
});
