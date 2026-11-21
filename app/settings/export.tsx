import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, Chip } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { View } from 'react-native';
import { useTheme } from '@/theme/useTheme';

const SETS = ['Habits', 'Check-ins', 'Journal'];

// UI PREVIEW: generates nothing yet. The real version writes CSV files and opens the iOS share sheet.
export default function ExportScreen() {
  const { spacing } = useTheme();
  const [picked, setPicked] = useState<string[]>(SETS);
  const [done, setDone] = useState(false);

  return (
    <Screen footer={<Button title="Export CSV" disabled={picked.length === 0} onPress={() => setDone(true)} />}>
      <Card>
        <Text variant="title2">Take your data with you</Text>
        <Text secondary>Choose what to include. You’ll get one CSV file for each, saved or shared from your phone.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SETS.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={picked.includes(s)}
              onPress={() => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
            />
          ))}
        </View>
      </Card>
      {done ? (
        <Text accessibilityLiveRegion="polite" secondary>
          Preview only: files aren’t generated yet.
        </Text>
      ) : null}
    </Screen>
  );
}
