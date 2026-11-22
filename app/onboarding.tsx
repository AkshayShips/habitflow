import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip, ListRow, Group, ProgressBar } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { createHabit, listHabits } from '@/features/habits/api/habitRepository';
import { markOnboardingDone } from '@/features/onboarding/useOnboarding';
import { MAX_STARTERS, planStarters, reminderFor, REMINDER_CHOICES, STARTERS, type ReminderChoice } from '@/features/onboarding/starters';
import { useReminder } from '@/features/reminders/useReminder';
import { scheduleSync } from '@/features/sync/syncManager';
import { FREE_HABIT_LIMIT, useIsPro } from '@/lib/entitlements';
import { getDb } from '@/lib/localDb';
import { useTheme } from '@/theme/useTheme';

export default function OnboardingScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [time, setTime] = useState<ReminderChoice>('Morning');
  const [busy, setBusy] = useState(false);
  const userId = useAuthStore((st) => st.session?.user.id);
  const isPro = useIsPro();
  const qc = useQueryClient();
  const { update: updateReminder } = useReminder();

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : p.length < MAX_STARTERS ? [...p, s] : p));
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const last = step === 2;

  async function finish() {
    if (!userId) return leave();
    setBusy(true);
    try {
      const db = await getDb(userId);
      const existing = await listHabits(db);
      const active = existing.filter((h) => h.archivedAt === null).length;
      const room = isPro ? 99 : FREE_HABIT_LIMIT - active;
      const plan = planStarters(picked, existing.map((h) => h.name), room);
      for (const input of plan) await createHabit(db, input);
      const have = new Set(existing.map((h) => h.name.trim().toLowerCase()));
      const wanted = picked.filter((n) => !have.has(n.toLowerCase())).length;
      if (plan.length < wanted) showToast(`The free plan holds ${FREE_HABIT_LIMIT} active habits, so some starters weren’t added.`, 'neutral');
      if (plan.length) {
        await qc.invalidateQueries({ queryKey: ['habits', userId] });
        scheduleSync(userId);
      }
      await markOnboardingDone();
      leave();
      // Reminder permission is asked only now, after the user chose a time.
      const r = reminderFor(time);
      if (r.enabled) {
        const res = await updateReminder(r);
        if (!res.ok && res.reason === 'permission-denied') showToast('Reminders are off. You can allow notifications in Settings.', 'neutral');
      }
    } catch {
      showToast('Couldn’t save your choices. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title={last ? 'Get started' : 'Continue'}
            disabled={step === 1 && picked.length === 0}
            loading={busy}
            onPress={() => (last ? void finish() : setStep(step + 1))}
          />
          {step > 0 ? <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        </>
      }
    >
      <ProgressBar value={(step + 1) / 3} label={`Step ${step + 1} of 3`} />

      {step === 0 && (
        <View style={{ gap: spacing.md, paddingTop: spacing.lg }}>
          <Ionicons name="leaf" size={48} color={colors.accent} />
          <Text variant="largeTitle">Small steps, steady progress</Text>
          <Text secondary>
            HabitFlow is built to be calm. There are no guilt trips or broken-chain shaming. Missed a day? You simply pick up again.
          </Text>
          <Group>
            <ListRow icon="checkmark-circle-outline" title="One tap check-ins" last={false} />
            <ListRow icon="cloud-offline-outline" title="Works offline, syncs when it can" />
            <ListRow icon="lock-closed-outline" title="Your data stays yours" last />
          </Group>
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: spacing.md }}>
          <Text variant="title1">Pick up to 3 to start</Text>
          <Text secondary>Start small. You can add or change these any time.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {STARTERS.map(({ name: s }) => (
              <Chip key={s} label={s} selected={picked.includes(s)} onPress={() => toggle(s)} />
            ))}
          </View>
          <Text variant="footnote" secondary>{picked.length} of {MAX_STARTERS} selected</Text>
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: spacing.md }}>
          <Text variant="title1">When should we nudge you?</Text>
          <Text secondary>One gentle reminder a day, at most. You can change this in Settings.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {REMINDER_CHOICES.map((t) => (
              <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
            ))}
          </View>
          <Text variant="footnote" secondary>
            iOS asks for notification permission only after you finish, and only if you chose a time.
          </Text>
        </View>
      )}
    </Screen>
  );
}
