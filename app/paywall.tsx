import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getNativeDriver } from '@/features/purchases/purchasesDriver';
import { usePurchaseStore } from '@/features/purchases/purchaseStore';
import { PRO_FEATURES } from '@/lib/pricing';
import { useTheme } from '@/theme/useTheme';

export default function PaywallScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { status, plans, isPro, buy, restore } = usePurchaseStore();
  const userId = useAuthStore((st) => st.session?.user.id);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = chosen ?? plans[0]?.id ?? null;

  async function purchase() {
    if (!plan) return;
    setBusy(true);
    const r = await buy(plan);
    setBusy(false);
    if (r === 'purchased') {
      showToast('Welcome to Pro', 'success');
      router.back();
    } else if (r === 'failed') showToast('The purchase didn’t go through. You haven’t been charged.', 'error');
  }

  async function doRestore() {
    setBusy(true);
    const r = await restore();
    setBusy(false);
    if (r === 'restored') {
      showToast('Pro restored', 'success');
      router.back();
    } else showToast(r === 'nothing' ? 'No earlier purchase found for this Apple ID.' : 'Couldn’t restore purchases. Try again.', r === 'nothing' ? 'neutral' : 'error');
  }

  async function retry() {
    if (!userId) return;
    await usePurchaseStore.getState().start(await getNativeDriver().catch(() => null), userId);
  }

  const canBuy = status === 'ready' && plans.length > 0 && !isPro;

  return (
    <Screen
      footer={
        <>
          {canBuy ? <Button title="Continue" loading={busy} onPress={() => void purchase()} /> : null}
          {status === 'ready' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Restore purchases" onPress={() => void doRestore()} disabled={busy} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
              <Text variant="footnote" style={{ color: colors.accent }}>Restore purchases</Text>
            </Pressable>
          ) : null}
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

      {isPro ? <Text accessibilityRole="alert" style={{ textAlign: 'center' }}>You already have HabitFlow Pro. Thank you!</Text> : null}
      {!isPro && (status === 'unavailable' || status === 'idle') ? (
        <Text secondary style={{ textAlign: 'center' }}>Purchases aren’t available in this version of the app yet.</Text>
      ) : null}
      {status === 'loading' ? <Text secondary style={{ textAlign: 'center' }}>Loading plans…</Text> : null}
      {status === 'error' ? (
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Text secondary style={{ textAlign: 'center' }}>Couldn’t load plans. Check your connection.</Text>
          <Button title="Try again" variant="ghost" onPress={() => void retry()} />
        </View>
      ) : null}
      {status === 'ready' && plans.length === 0 && !isPro ? (
        <Text secondary style={{ textAlign: 'center' }}>Pro isn’t available to buy right now. Please try again later.</Text>
      ) : null}

      {canBuy ? (
        <View style={{ gap: spacing.sm }}>
          {plans.map((p) => {
            const on = plan === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${p.title}, ${p.priceString} per ${p.per}. ${p.note}`}
                onPress={() => setChosen(p.id)}
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
                <Text variant="headline">{p.priceString}<Text secondary variant="footnote"> / {p.per}</Text></Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text variant="footnote" secondary>
        Subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Manage or cancel any time in your Apple ID settings.
      </Text>
      <Button title="Not now" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
