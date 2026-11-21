import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const HABIT_ICONS = [
  'checkmark-circle', 'walk', 'barbell', 'bicycle', 'book', 'pencil', 'laptop', 'leaf',
  'water', 'moon', 'heart', 'cafe', 'musical-notes', 'happy',
] as const;

/** Stored icon names come from the DB/server, so verify they exist before rendering. */
export function HabitIcon({ name, size = 22, color }: { name: string; size?: number; color: string }) {
  const safe = (name in Ionicons.glyphMap ? name : 'checkmark-circle') as IconName;
  return <Ionicons name={safe} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}
