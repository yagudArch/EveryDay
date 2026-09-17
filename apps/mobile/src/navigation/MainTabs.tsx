import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';

import { ActivityScreen } from '../screens/ActivityScreen';
import { AiScreen } from '../screens/AiScreen';
import { FoodShoppingScreen } from '../screens/FoodShoppingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NutritionScreen } from '../screens/NutritionScreen';
import { useThemeTokens } from '../theme/ThemeProvider';
import type { MainTabParamList } from './types';

const Tabs = createBottomTabNavigator<MainTabParamList>();

/**
 * Иконок из icon-пакетов нет намеренно: вкладки подписаны текстом (доступность и
 * отсутствие лишних зависимостей), активная вкладка помечена точкой.
 */
function TabDot({ color, focused }: { color: string; focused: boolean }) {
  return <View style={[styles.dot, { backgroundColor: color, opacity: focused ? 1 : 0.35 }]} />;
}

export function MainTabs() {
  const theme = useThemeTokens();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.caption.fontSize,
          fontWeight: theme.typography.bodyStrong.fontWeight,
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, focused }) => <TabDot color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{
          title: 'Питание',
          tabBarIcon: ({ color, focused }) => <TabDot color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Food"
        component={FoodShoppingScreen}
        options={{
          title: 'Еда и покупки',
          tabBarIcon: ({ color, focused }) => <TabDot color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          title: 'Активность',
          tabBarIcon: ({ color, focused }) => <TabDot color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Ai"
        component={AiScreen}
        options={{
          title: 'AI',
          tabBarIcon: ({ color, focused }) => <TabDot color={color} focused={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3 },
});
