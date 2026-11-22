import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Card';
import { LargeHeader } from '@/components/ui/LargeHeader';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store/authStore';
import { askCoach, clearHistory, loadHistory, type CoachFailure, type CoachMessage } from '@/features/coach/coachApi';
import { giveCoachConsent, hasCoachConsent } from '@/features/coach/coachConsent';
import { showToast } from '@/components/ui/Toast';
import { IS_DEMO } from '@/lib/demo';
import { useIsPro } from '@/lib/entitlements';
import { useTheme } from '@/theme/useTheme';

const FREE_DAILY_MESSAGES = 3;
const STARTERS = ['Help me stay consistent', 'I missed a few days', 'Suggest a tiny new habit', 'Review my week'];
const INTRO = 'Hi, I’m your coach. I can help you plan small habits, get back on track, or make sense of your week. What would help most right now?';

const FAILURE_TEXT: Record<CoachFailure, string> = {
  unavailable: 'The coach isn’t available right now. You haven’t used a message. Please try again later.',
  network: 'Couldn’t reach the coach. Check your connection and try again.',
  auth: 'Please sign in again to use the coach.',
  too_long: 'That message is too long. Please shorten it.',
  empty: 'Type a message first.',
  limit: 'That’s today’s free messages.',
};

export default function CoachScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isPro = useIsPro();
  const userId = useAuthStore((st) => st.session?.user.id);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [consent, setConsent] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [used, setUsed] = useState<number | null>(null); // known only from the server's reply
  const [limitHit, setLimitHit] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void hasCoachConsent().then((c) => alive && setConsent(c));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!consent || IS_DEMO) return;
    let alive = true;
    void loadHistory().then((h) => alive && setMessages(h));
    return () => {
      alive = false;
    };
  }, [consent]);

  const remaining = used === null ? null : Math.max(0, FREE_DAILY_MESSAGES - used);
  const blocked = !isPro && (limitHit || remaining === 0);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || blocked || thinking) return;
      setNotice(null);
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: clean }]);
      setDraft('');
      setThinking(true);
      const r = await askCoach(clean);
      setThinking(false);
      if (r.ok) {
        setUsed(r.used);
        setMessages((m) => [...m, { id: `a${Date.now()}`, role: 'assistant', text: r.reply }]);
        return;
      }
      // The server did not answer, so take our optimistic message back out and restore the draft.
      setMessages((m) => m.slice(0, -1));
      setDraft(clean);
      if (r.failure === 'limit') {
        setLimitHit(true);
        setUsed(r.used ?? FREE_DAILY_MESSAGES);
      } else setNotice(FAILURE_TEXT[r.failure]);
    },
    [blocked, thinking],
  );

  async function clear() {
    if (!userId) return;
    const ok = await clearHistory(userId);
    if (ok) setMessages([]);
    showToast(ok ? 'Conversation cleared' : 'Couldn’t clear the conversation', ok ? 'success' : 'error');
  }

  if (IS_DEMO) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <LargeHeader title="Coach" />
        <Text secondary>The coach talks to a server, so it isn’t available in this offline preview. It works in the full app once it’s connected.</Text>
      </View>
    );
  }

  if (consent === null) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  if (!consent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <LargeHeader title="Coach" />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
          <Text variant="title2">Before you chat</Text>
          <Text secondary>
            Your messages are sent to our server and then to Anthropic’s Claude, which writes the replies. Your habits, check-ins and journal are not sent.
          </Text>
          <Text secondary>
            Your conversation is saved to your account so the coach can follow along. You can clear it any time from this screen.
          </Text>
          <Text secondary>The coach is AI-generated. It isn’t a doctor or therapist and can make mistakes.</Text>
          <Button title="I understand, continue" onPress={() => void giveCoachConsent().then(() => setConsent(true))} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs }}>
        <LargeHeader title="Coach" />
        <Text variant="footnote" secondary>
          {isPro ? 'Unlimited messages' : remaining === null ? `Free plan: ${FREE_DAILY_MESSAGES} messages a day` : `${remaining} of ${FREE_DAILY_MESSAGES} free messages left today`}
          {' · AI-generated, not professional advice'}
        </Text>
      </View>

      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={{ alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: colors.surface, borderRadius: 20, borderBottomLeftRadius: 6, padding: spacing.md }}>
            <Text>{INTRO}</Text>
          </View>
        ) : null}
        {messages.map((m) => (
          <View
            key={m.id}
            accessible
            accessibilityLabel={`${m.role === 'user' ? 'You' : 'Coach'}: ${m.text}`}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              backgroundColor: m.role === 'user' ? colors.accent : colors.surface,
              borderRadius: 20,
              ...(m.role === 'user' ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: m.role === 'user' ? colors.accentText : colors.text }}>{m.text}</Text>
          </View>
        ))}
        {thinking ? (
          <View accessibilityLiveRegion="polite" style={{ alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
            <Text secondary>Coach is typing…</Text>
          </View>
        ) : null}

        {messages.length === 0 && !blocked ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {STARTERS.map((s) => (
              <Chip key={s} label={s} onPress={() => void send(s)} />
            ))}
          </View>
        ) : null}

        {notice ? <Text accessibilityRole="alert" style={{ color: colors.dangerInk }}>{notice}</Text> : null}

        {messages.length > 0 ? (
          <Text variant="footnote" secondary accessibilityRole="button" onPress={() => void clear()} style={{ alignSelf: 'center', paddingVertical: spacing.sm }}>
            Clear conversation
          </Text>
        ) : null}

        {blocked ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
            <Text variant="title2">That’s today’s free messages</Text>
            <Text secondary>Your allowance resets tomorrow. Pro removes the daily limit.</Text>
            <Button title="See Pro" onPress={() => router.push('/paywall')} />
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md,
          paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          editable={!blocked}
          multiline
          maxLength={1000}
          placeholder={blocked ? 'Come back tomorrow' : 'Ask your coach…'}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Message to coach"
          style={{
            flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.bg, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 17,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={blocked || thinking || draft.trim().length === 0}
          onPress={() => void send(draft)}
          style={{
            width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.accent, opacity: blocked || thinking || draft.trim().length === 0 ? 0.4 : 1,
          }}
        >
          <Ionicons name="arrow-up" size={22} color={colors.accentText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
