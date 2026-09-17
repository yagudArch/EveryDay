import { StyleSheet, Text, View } from 'react-native';

import { useThemeTokens } from '../theme/ThemeProvider';
import { Card, ModulePlaceholder, Screen, StatusPill } from '../ui';

export function FoodShoppingScreen() {
  const theme = useThemeTokens();

  return (
    <Screen>
      <Card
        title="Еда и покупки"
        subtitle="Продукты дома, рецепты и список покупок связаны между собой и появятся вместе (этап FOOD-001)."
      >
        <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
          <StatusPill label="продукты дома: нет данных" tone="warning" />
          <StatusPill label="рецепты: нет данных" tone="warning" />
          <StatusPill label="покупки: нет данных" tone="warning" />
        </View>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          }}
        >
          Списком покупок нельзя «поделиться» примером: приложение покажет только реальные остатки, рецепты и позиции
          из backend.
        </Text>
      </Card>

      <ModulePlaceholder
        title="Что есть дома"
        stage="Этап FOOD-001"
        description="Ручное добавление продукта, распознавание фото холодильника и штрихкоды будут реализованы на этом этапе."
      />
      <ModulePlaceholder
        title="Что приготовить"
        stage="Этап FOOD-001"
        description="Рецепты будут учитывать остатки дома, цель по КБЖУ, предпочтения и аллергии. Пока рекомендации не формируются."
      />
      <ModulePlaceholder
        title="Список покупок"
        stage="Этап FOOD-001"
        description="Автоматическое формирование списка из рецептов и планов питания будет добавлено вместе с модулем продуктов."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
