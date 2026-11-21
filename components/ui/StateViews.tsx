import { View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { Text } from './Text';

export function EmptyState({ title, body, actionLabel, onAction }: {
  title: string; body: string; actionLabel?: string; onAction?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
      <Text variant="title2">{title}</Text>
      <Text secondary>{body}</Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}
    >
      <Text variant="title2">Something went wrong</Text>
      <Text secondary>{message}</Text>
      <Button title="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { spacing } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={{ gap: spacing.sm }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} />
      ))}
    </View>
  );
}
