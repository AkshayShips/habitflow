import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { MAX_BODY } from '@/features/journal/api/journalRepository';
import { useDeleteJournalEntry, useJournalEntries, useSaveJournalEntry } from '@/features/journal/hooks/useJournal';
import { MOODS } from '@/features/journal/moods';
import { useTodayStr } from '@/features/habits/hooks/useHabits';
import { useTheme } from '@/theme/useTheme';

const pretty = (s: string) => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function JournalScreen() {
  const { colors, spacing, radius } = useTheme();
  const today = useTodayStr();
  const q = useJournalEntries();
  const save = useSaveJournalEntry();
  const del = useDeleteJournalEntry();

  // Which day the composer is editing (default: today). Until the user types, the saved entry is shown.
  const [date, setDate] = useState<string | null>(null);
  const [draftText, setText] = useState<string | null>(null);
  const [draftMood, setMood] = useState<number | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (q.isPending) return <Screen><ListSkeleton rows={3} /></Screen>;
  if (q.error) return <Screen><ErrorState message="We couldn’t load your journal." onRetry={() => void q.refetch()} /></Screen>;

  const editing = date ?? today;
  const entries = q.data ?? [];
  const existing = entries.find((e) => e.date === editing);
  const text = draftText ?? existing?.body ?? '';
  const mood = draftMood === undefined ? (existing?.mood ?? null) : draftMood;
  const dirty = draftText !== null || draftMood !== undefined;
  const canSave = dirty && (text.trim().length > 0 || mood !== null || existing !== undefined);

  const reset = (d: string | null) => {
    setDate(d);
    setText(null);
    setMood(undefined);
    setConfirmDelete(false);
  };

  return (
    <Screen>
      <Card>
        <Text variant="title2">{editing === today ? 'How was today?' : `Entry for ${pretty(editing)}`}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {MOODS.map((m) => {
            const on = mood === m.value;
            return (
              <Pressable
                key={m.value}
                accessibilityRole="button"
                accessibilityLabel={`Mood: ${m.label}`}
                accessibilityState={{ selected: on }}
                onPress={() => setMood(on ? null : m.value)}
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
          maxLength={MAX_BODY}
          placeholder="A line or two is plenty."
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Journal entry"
          style={{
            minHeight: 96, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
            color: colors.text, padding: spacing.md, fontSize: 17, textAlignVertical: 'top',
          }}
        />
        <Button
          title={existing ? 'Save changes' : 'Save entry'}
          disabled={!canSave}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { date: editing, body: text, mood },
              {
                onSuccess: () => {
                  reset(null);
                  showToast('Saved', 'success');
                },
                onError: () => showToast('Couldn’t save. Your text is still here, so try again.', 'error'),
              },
            )
          }
        />
        {existing ? (
          <Button
            title={confirmDelete ? 'Tap again to delete this entry' : 'Delete entry'}
            variant={confirmDelete ? 'danger' : 'ghost'}
            loading={del.isPending}
            onPress={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              del.mutate(editing, {
                onSuccess: () => {
                  reset(null);
                  showToast('Entry deleted', 'success');
                },
                onError: () => showToast('Couldn’t delete. Please try again.', 'error'),
              });
            }}
          />
        ) : null}
        {editing !== today ? <Button title="Back to today" variant="ghost" onPress={() => reset(null)} /> : null}
      </Card>

      <Text variant="headline">Past entries</Text>
      {entries.length === 0 ? (
        <Text secondary>Nothing here yet. Your entries are private to you and appear here once saved.</Text>
      ) : null}
      {entries.map((e) => {
        const m = MOODS.find((x) => x.value === e.mood);
        return (
          <Pressable
            key={e.date}
            accessibilityRole="button"
            accessibilityLabel={`${pretty(e.date)}${m ? `, mood ${m.label}` : ''}. ${e.body || 'No text.'} Tap to edit.`}
            onPress={() => reset(e.date)}
          >
            <Card style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {m ? <Ionicons name={m.icon} size={20} color={colors.accent} /> : null}
                <Text variant="headline">{pretty(e.date)}</Text>
                {m ? <Text secondary>{m.label}</Text> : null}
              </View>
              {e.body ? <Text numberOfLines={4}>{e.body}</Text> : null}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
