import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import { HabitForm } from '@/features/habits/components/HabitForm';
import { useArchiveHabit, useDeleteHabit, useHabit, useUpdateHabit } from '@/features/habits/hooks/useHabits';
import { useTheme } from '@/theme/useTheme';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const habitQ = useHabit(id);
  const update = useUpdateHabit(id);
  const archive = useArchiveHabit();
  const remove = useDeleteHabit();
  const habit = habitQ.data;

  const wrap = (children: React.ReactNode) => (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (habitQ.isPending) return wrap(<ListSkeleton rows={3} />);
  if (habitQ.error) return wrap(<ErrorState message="Couldn’t open this habit." onRetry={() => void habitQ.refetch()} />);
  if (!habit) return wrap(<Text secondary>This habit no longer exists.</Text>);

  const archived = habit.archivedAt !== null;

  return wrap(
    <>
      <HabitForm
        submitLabel="Save changes"
        initial={{
          name: habit.name, icon: habit.icon, color: habit.color, category: habit.category,
          cadence: habit.cadence, targetValue: habit.targetValue, unit: habit.unit,
        }}
        onSubmit={async (input) => {
          await update.mutateAsync(input);
          router.back();
        }}
      />

      <View style={{ gap: spacing.sm }}>
        <Button
          title={archived ? 'Restore habit' : 'Archive habit'}
          variant="secondary"
          onPress={() =>
            archive.mutate(
              { id: habit.id, archived: !archived },
              {
                onSuccess: () => router.back(),
                onError: (e) => Alert.alert('Can’t restore', e.message),
              },
            )
          }
        />
        <Text variant="footnote" secondary>
          Archiving hides a habit from Today but keeps your history.
        </Text>
        <Button
          title="Delete habit"
          variant="ghost"
          onPress={() =>
            Alert.alert('Delete this habit?', 'Its history will be removed. This can’t be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => remove.mutate(habit.id, { onSuccess: () => router.back() }),
              },
            ])
          }
        />
      </View>
    </>,
  );
}
