import { StyleSheet, Text, View } from 'react-native';

import { useThemeTokens } from '../theme/ThemeProvider';
import { Card, ModulePlaceholder, Screen, StatusPill } from '../ui';

export function ActivityScreen() {
  const theme = useThemeTokens();

  return (
    <Screen>
      <Card
        title="Активность"
        subtitle="Данные о шагах, тренировках, весе и активных калориях появятся только после явного разрешения пользователя."
      >
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <StatusPill label="тренировки: нет данных" tone="warning" />
          <StatusPill label="шаги: нет данных" tone="warning" />
          <StatusPill label="вес: нет данных" tone="warning" />
        </View>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          HealthKit и Health Connect не подключены, разрешения на здоровье не запрашиваются. Пока это состояние
          отображается честно, без примерных значений.
        </Text>
      </Card>

      <ModulePlaceholder
        title="Тренировки и ручной ввод"
        stage="Этап ACT-001"
        description="Ручное добавление активности будет реализовано раньше системных интеграций — оно не требует разрешений устройства."
      />
      <ModulePlaceholder
        title="Apple Health / Health Connect"
        stage="Этап ACT-001"
        description="Интеграция появится вместе с development build и явным согласием пользователя; в Foundation такие разрешения не запрашиваются."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
