import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'sunny-outline' },
  { name: 'habits', title: 'Habits', icon: 'checkmark-done-outline' },
  { name: 'stats', title: 'Stats', icon: 'stats-chart-outline' },
  { name: 'coach', title: 'Coach', icon: 'chatbubble-ellipses-outline' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: `${t.title} tab`,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} size={size} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
