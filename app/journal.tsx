import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MOCK_JOURNAL, MOODS, type JournalEntry } from '@/features/preview/mock';
import { todayStr } from '@/features/habits/logic/dates';
import { useTheme } from '@/theme/useTheme';

const pretty = (s: string) => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

// UI PREVIEW: entries live in component state only.
export default function JournalScreen() {
  const { colors, spacing, radius } = useTheme();
  const [entries, setEntries] = useState<JournalEntry[]>(MOCK_JOURNAL);
  const [mood, setMood] = useState<JournalEntry['mood'] | null>(null);
  const [text, setText] = useState('');

  const canSave = mood !== null && text.trim().length > 0;

  function save() {
    if (!canSave || mood === null) return;
    setEntries((e) => [{ id: `n${e.length}`, date: todayStr(), mood, text: text.trim() }, ...e]);
    setText('');
    setMood(null);
  }

  return (
    <Screen>
      <Card>
        <Text variant="title2">How was today?</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {MOODS.map((m) => {
            const on = mood === m.value;
            return (
              <Pressable
                key={m.value}
                accessibilityRole="button"
                accessibilityLabel={`Mood: ${m.label}`}
                accessibilityState={{ selected: on }}
                onPress={() => setMood(m.value)}
                style={{
                  width: 58, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
                  borderRadius: radius.md, backgroundColor: on ? colors.accent : colors.surfaceAlt,
                }}
              >
                <Ionicons name={m.icon} size={24} color={on ? colors.accentText : colors.text} />
                <Text variant="caption" style={{ color: on ? colors.accentText : colors.text }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          placeholder="A line or two is plenty."
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Journal entry"
          style={{
            minHeight: 96, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
            color: colors.text, padding: spacing.md, fontSize: 17, textAlignVertical: 'top',
          }}
        />
        <Button title="Save entry" disabled={!canSave} onPress={save} />
      </Card>

      <Text variant="headline">Past entries</Text>
      {entries.map((e) => {
        const mood = MOODS.find((m) => m.value === e.mood);
        return (
          <Card key={e.id} style={{ gap: spacing.xs }}>
            <View accessible accessibilityLabel={`${pretty(e.date)}, mood ${mood?.label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name={mood?.icon ?? 'sunny-outline'} size={20} color={colors.accent} />
              <Text variant="headline">{pretty(e.date)}</Text>
              <Text secondary>{mood?.label}</Text>
            </View>
            <Text>{e.text}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}
