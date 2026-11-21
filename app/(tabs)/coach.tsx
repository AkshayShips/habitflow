import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Card';
import { LargeHeader } from '@/components/ui/LargeHeader';
import { Text } from '@/components/ui/Text';
import { COACH_CANNED_REPLY, COACH_INTRO, COACH_STARTERS, type CoachMessage } from '@/features/preview/mock';
import { useIsPro } from '@/lib/entitlements';
import { useTheme } from '@/theme/useTheme';

const FREE_DAILY_MESSAGES = 3;

// UI PREVIEW: replies are canned and the daily counter is local state.
// The real version calls a Supabase Edge Function that enforces the limit server-side.
export default function CoachScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isPro = useIsPro();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [messages, setMessages] = useState<CoachMessage[]>([COACH_INTRO]);
  const [draft, setDraft] = useState('');
  const [used, setUsed] = useState(0);
  const [thinking, setThinking] = useState(false);

  const remaining = Math.max(0, FREE_DAILY_MESSAGES - used);
  const blocked = !isPro && remaining === 0;

  function send(text: string) {
    const clean = text.trim();
    if (!clean || blocked || thinking) return;
    setMessages((m) => [...m, { id: `u${m.length}`, role: 'user', text: clean }]);
    setDraft('');
    setUsed((n) => n + 1);
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [...m, { id: `c${m.length}`, role: 'coach', text: COACH_CANNED_REPLY }]);
      setThinking(false);
    }, 900);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs }}>
        <LargeHeader title="Coach" />
        <Text variant="footnote" secondary>
          {isPro ? 'Unlimited messages' : `${remaining} of ${FREE_DAILY_MESSAGES} free messages left today`}
          {' · AI-generated, not professional advice'}
        </Text>
      </View>

      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
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

        {messages.length === 1 && !blocked ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {COACH_STARTERS.map((s) => (
              <Chip key={s} label={s} onPress={() => send(s)} />
            ))}
          </View>
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
          onPress={() => send(draft)}
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
