import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { PLACEHOLDER_PLANS, PRO_FEATURES } from '@/lib/pricing';
import { useTheme } from '@/theme/useTheme';

// UI PREVIEW: no purchase happens. Wire to RevenueCat offerings in the paywall phase.
export default function PaywallScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const [plan, setPlan] = useState<string>('yearly');

  return (
    <Screen
      footer={
        <>
          <Button title="Continue" onPress={() => undefined} disabled />
          <Text variant="caption" secondary style={{ textAlign: 'center' }}>
            Purchases are not connected yet in this preview.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Restore purchases" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text variant="footnote" style={{ color: colors.accent }}>Restore purchases</Text>
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel="Terms of Use" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text variant="footnote" style={{ color: colors.accent }}>Terms</Text>
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel="Privacy Policy" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text variant="footnote" style={{ color: colors.accent }}>Privacy</Text>
            </Pressable>
          </View>
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md }}>
        <Ionicons name="sparkles" size={36} color={colors.accent} />
        <Text variant="title1" style={{ textAlign: 'center' }}>HabitFlow Pro</Text>
        <Text secondary style={{ textAlign: 'center' }}>More room to grow, at your own pace.</Text>
      </View>

      <Card style={{ gap: 0, padding: 0 }}>
        <View style={{ flexDirection: 'row', padding: spacing.md }}>
          <View style={{ flex: 1.4 }} />
          <Text variant="caption" secondary style={{ flex: 1 }}>Free</Text>
          <Text variant="caption" style={{ flex: 1, color: colors.accent }}>Pro</Text>
        </View>
        {PRO_FEATURES.map((f) => (
          <View
            key={f.title}
            accessible
            accessibilityLabel={`${f.title}. Free: ${f.free}. Pro: ${f.pro}.`}
            style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <View style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name={f.icon} size={20} color={colors.accent} />
              <Text variant="callout" style={{ flex: 1 }}>{f.title}</Text>
            </View>
            <Text variant="footnote" secondary style={{ flex: 1 }}>{f.free}</Text>
            <Text variant="footnote" style={{ flex: 1 }}>{f.pro}</Text>
          </View>
        ))}
      </Card>

      <View style={{ gap: spacing.sm }}>
        {PLACEHOLDER_PLANS.map((p) => {
          const on = plan === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${p.title}, ${p.price} per ${p.per}. ${p.note}`}
              onPress={() => setPlan(p.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 64,
                borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: on ? colors.accent : colors.border,
              }}
            >
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.accent : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{p.title}</Text>
                <Text variant="footnote" secondary>{p.note}</Text>
              </View>
              <Text variant="headline">{p.price}<Text secondary variant="footnote"> / {p.per}</Text></Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="footnote" secondary>
        Subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Manage or cancel any time in your Apple ID settings.
      </Text>
      <Button title="Not now" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
