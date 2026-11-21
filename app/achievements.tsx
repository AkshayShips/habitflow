import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, ProgressBar } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MOCK_ACHIEVEMENTS, MOCK_XP } from '@/features/preview/mock';
import { useTheme } from '@/theme/useTheme';

// UI PREVIEW: XP and unlock states are mock data. The server already has the achievements tables.
export default function AchievementsScreen() {
  const { colors, spacing, radius } = useTheme();
  const unlocked = MOCK_ACHIEVEMENTS.filter((a) => a.unlocked).length;

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="title1">Level {MOCK_XP.level}</Text>
          <Text secondary>{MOCK_XP.title}</Text>
        </View>
        <ProgressBar value={MOCK_XP.xp / MOCK_XP.nextLevelXp} label={`${MOCK_XP.xp} of ${MOCK_XP.nextLevelXp} XP to next level`} />
        <Text variant="footnote" secondary>{MOCK_XP.xp} / {MOCK_XP.nextLevelXp} XP · Every check-in counts. Missed days never remove XP.</Text>
      </Card>

      <Text variant="headline">{unlocked} of {MOCK_ACHIEVEMENTS.length} unlocked</Text>
      {MOCK_ACHIEVEMENTS.map((a) => (
        <View
          key={a.id}
          accessible
          accessibilityLabel={`${a.title}. ${a.description} ${a.unlocked ? 'Unlocked.' : `Locked. ${a.progress ?? ''}`}`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
            backgroundColor: colors.surface, borderRadius: radius.lg, opacity: a.unlocked ? 1 : 0.75,
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: a.unlocked ? colors.accent : colors.surfaceAlt }}>
            <Ionicons
              name={a.unlocked ? (a.icon as React.ComponentProps<typeof Ionicons>['name']) : 'lock-closed'}
              size={22}
              color={a.unlocked ? colors.accentText : colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline">{a.title}</Text>
            <Text variant="footnote" secondary>{a.description}</Text>
            {!a.unlocked && a.progress ? <Text variant="caption" secondary>{a.progress}</Text> : null}
          </View>
        </View>
      ))}
    </Screen>
  );
}
