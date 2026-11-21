import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { HABIT_ICONS, HabitIcon } from '@/components/ui/HabitIcon';
import { Text } from '@/components/ui/Text';
import { habitPalette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { habitInputSchema, type HabitInput } from '../schemas/habit';
import type { Cadence, CadenceType } from '../logic/types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CADENCES: { type: CadenceType; label: string }[] = [
  { type: 'daily', label: 'Daily' },
  { type: 'weekly_days', label: 'Days' },
  { type: 'x_per_week', label: 'Per week' },
  { type: 'interval', label: 'Every N' },
];

interface Props {
  initial?: HabitInput;
  submitLabel: string;
  onSubmit: (input: HabitInput) => Promise<void>;
}

const defaultCadence = (type: CadenceType): Cadence => {
  switch (type) {
    case 'daily': return { type, config: {} };
    case 'weekly_days': return { type, config: { days: [1, 2, 3, 4, 5] } };
    case 'x_per_week': return { type, config: { times: 3 } };
    case 'interval': return { type, config: { every_days: 2 } };
  }
};

export function HabitForm({ initial, submitLabel, onSubmit }: Props) {
  const { colors, spacing, radius } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? habitPalette[0]);
  const [icon, setIcon] = useState(initial?.icon ?? 'checkmark-circle');
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? defaultCadence('daily'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chip = (selected: boolean) => ({
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: selected ? colors.accent : colors.surfaceAlt,
  });
  const chipText = (selected: boolean) => ({ color: selected ? colors.accentText : colors.text });

  async function submit() {
    setError(null);
    const input: HabitInput = { name, color, icon, cadence, category: initial?.category ?? null };
    const parsed = habitInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this habit.');
    } finally {
      setBusy(false);
    }
  }

  const days = cadence.config.days ?? [];

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="headline">Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Read 20 pages"
          placeholderTextColor={colors.textSecondary}
          maxLength={80}
          accessibilityLabel="Habit name"
          returnKeyType="done"
          style={{
            minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, fontSize: 17,
          }}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="headline">How often</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {CADENCES.map((c) => (
            <Pressable
              key={c.type}
              accessibilityRole="radio"
              accessibilityState={{ selected: cadence.type === c.type }}
              onPress={() => setCadence(defaultCadence(c.type))}
              style={chip(cadence.type === c.type)}
            >
              <Text style={chipText(cadence.type === c.type)}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {cadence.type === 'weekly_days' && (
          <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'space-between' }}>
            {DAY_LABELS.map((label, i) => {
              const on = days.includes(i);
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityLabel={DAY_NAMES[i]}
                  accessibilityState={{ checked: on }}
                  onPress={() =>
                    setCadence({
                      type: 'weekly_days',
                      config: { days: on ? days.filter((d) => d !== i) : [...days, i].sort() },
                    })
                  }
                  style={[chip(on), { paddingHorizontal: 0, flex: 1 }]}
                >
                  <Text style={chipText(on)}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {cadence.type === 'x_per_week' && (
          <Stepper
            label="times per week"
            value={cadence.config.times ?? 3}
            min={1}
            max={7}
            onChange={(times) => setCadence({ type: 'x_per_week', config: { times } })}
          />
        )}

        {cadence.type === 'interval' && (
          <Stepper
            label="days between"
            value={cadence.config.every_days ?? 2}
            min={2}
            max={30}
            onChange={(every_days) => setCadence({ type: 'interval', config: { every_days } })}
          />
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="headline">Color</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {habitPalette.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ selected: color === c }}
              onPress={() => setColor(c)}
              style={{
                width: 44, height: 44, borderRadius: radius.pill, backgroundColor: c,
                borderWidth: color === c ? 3 : 0, borderColor: colors.text,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="headline">Icon</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {HABIT_ICONS.map((i) => (
            <Pressable
              key={i}
              accessibilityRole="radio"
              accessibilityLabel={`Icon ${i}`}
              accessibilityState={{ selected: icon === i }}
              onPress={() => setIcon(i)}
              style={[chip(icon === i), { paddingHorizontal: 0, width: 44 }]}
            >
              <HabitIcon name={i} color={icon === i ? colors.accentText : colors.text} />
            </Pressable>
          ))}
        </View>
      </View>

      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.dangerInk }}>
          {error}
        </Text>
      )}
      <Button title={submitLabel} loading={busy} onPress={() => void submit()} />
    </View>
  );
}

function Stepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const btn = {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min} onPress={() => onChange(value - 1)} style={[btn, value <= min && { opacity: 0.4 }]}>
        <Text variant="title2">−</Text>
      </Pressable>
      <Text variant="headline" accessibilityLiveRegion="polite">{value} {label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`}
        disabled={value >= max} onPress={() => onChange(value + 1)} style={[btn, value >= max && { opacity: 0.4 }]}>
        <Text variant="title2">+</Text>
      </Pressable>
    </View>
  );
}
