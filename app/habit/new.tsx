import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { showToast } from '@/components/ui/Toast';
import { HabitForm } from '@/features/habits/components/HabitForm';
import { useCreateHabit } from '@/features/habits/hooks/useHabits';
import { useTheme } from '@/theme/useTheme';

export default function NewHabitScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const create = useCreateHabit();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg }}>
        <HabitForm
          submitLabel="Create habit"
          onSubmit={async (input) => {
            await create.mutateAsync(input);
            router.back();
            showToast('Habit created', 'success');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
