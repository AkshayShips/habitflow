import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'today-outline', active: 'today' },
  { name: 'habits', title: 'Habits', icon: 'checkmark-circle-outline', active: 'checkmark-circle' },
  { name: 'stats', title: 'Stats', icon: 'stats-chart-outline', active: 'stats-chart' },
  { name: 'coach', title: 'Coach', icon: 'chatbubble-ellipses-outline', active: 'chatbubble-ellipses' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', active: 'person-circle' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth,
          // react-native-web does not add the iOS safe-area/label padding, so give the bar room for its labels.
          ...(Platform.OS === 'web' ? ({ height: 'calc(68px + env(safe-area-inset-bottom))', paddingTop: 6, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' } as object) : null),
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', paddingBottom: 2, paddingTop: 2 },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: `${t.title} tab`,
            tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? t.active : t.icon} size={size + 1} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
