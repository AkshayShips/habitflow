import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, ProgressBar } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import { useGamification } from '@/features/gamification/hooks/useGamification';
import { levelProgress } from '@/features/gamification/logic/level';
import { IS_DEMO } from '@/lib/demo';
import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
// Icons are a client concern; keys come from the server catalog. Unknown keys fall back to a ribbon.
const ICONS: Record<string, IconName> = {
  first_habit: 'footsteps',
  first_checkin: 'checkmark-circle',
  first_journal: 'book',
  perfect_day: 'star',
  streak_7: 'calendar',
  streak_30: 'ribbon',
  streak_100: 'trophy',
  level_5: 'trending-up',
};

export default function AchievementsScreen() {
  const { colors, spacing, radius } = useTheme();
  const q = useGamification();

  if (IS_DEMO) {
    return (
      <Screen>
        <Card>
          <Text variant="headline">Not available in the preview</Text>
          <Text secondary>
            XP and achievements are calculated on the server after your check-ins sync, so there is nothing to show in
            this browser demo. They appear in the real app once you’re signed in.
          </Text>
        </Card>
      </Screen>
    );
  }
  if (q.isPending) return <Screen><ListSkeleton rows={4} /></Screen>;
  if (q.error || !q.data) {
    return <Screen><ErrorState message="We couldn’t load your progress. Check your connection and try again." onRetry={() => void q.refetch()} /></Screen>;
  }

  const p = levelProgress(q.data.xp);
  const unlocked = q.data.achievements.filter((a) => a.unlockedAt).length;

  return (
    <Screen>
      <Card>
        <Text variant="title1">Level {p.level}</Text>
        <ProgressBar value={p.fraction} label={`${p.xp - p.levelStartXp} of ${p.nextLevelXp - p.levelStartXp} XP to level ${p.level + 1}`} />
        <Text variant="footnote" secondary>
          {p.xp} XP in total. Check-ins, perfect days and journal entries earn XP. Missed days never remove it. New
          check-ins show up here after they sync.
        </Text>
      </Card>

      <Text variant="headline">{unlocked} of {q.data.achievements.length} unlocked</Text>
      {q.data.achievements.map((a) => {
        const on = a.unlockedAt !== null;
        return (
          <View
            key={a.key}
            accessible
            accessibilityLabel={`${a.title}. ${a.description} ${on ? 'Unlocked.' : 'Locked.'}`}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
              backgroundColor: colors.surface, borderRadius: radius.lg, opacity: on ? 1 : 0.75,
            }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : colors.surfaceAlt }}>
              <Ionicons name={on ? (ICONS[a.key] ?? 'ribbon') : 'lock-closed'} size={22} color={on ? colors.accentText : colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{a.title}</Text>
              <Text variant="footnote" secondary>{a.description}</Text>
              {on ? <Text variant="caption" secondary>Unlocked {new Date(a.unlockedAt as string).toLocaleDateString()}</Text> : null}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
