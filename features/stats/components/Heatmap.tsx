import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';
import type { HeatCell, Level } from '../logic/stats';

const CELL = 18;
const GAP = 3;
const OPACITY: Record<Level, number> = { 0: 1, 1: 0.3, 2: 0.5, 3: 0.75, 4: 1 };
const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

interface Props {
  columns: HeatCell[][];
  /** Oldest date the user may see; older cells render locked. null = everything visible. */
  visibleFrom: string | null;
  summary: string;
}

/**
 * GitHub-style grid: columns are weeks, rows are Mon..Sun. Color encodes completion, and the whole grid
 * is one accessible element with a text summary (105 individually-focusable cells would be unusable).
 */
export function Heatmap({ columns, visibleFrom, summary }: Props) {
  const { colors, spacing } = useTheme();
  const rows = Array.from({ length: 7 }, (_, r) => columns.map((col) => col[r] as HeatCell));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: spacing.sm }}>
      <View style={{ gap: GAP }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: GAP }}>
            <Text variant="caption" secondary style={{ width: 14 }} maxFontSizeMultiplier={1}>
              {DAY_LABELS[r]}
            </Text>
            {row.map((cell) => {
              const locked = visibleFrom !== null && cell.date < visibleFrom;
              const empty = cell.future || locked || cell.level === 0;
              return (
                <View
                  key={cell.date}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 4,
                    backgroundColor: empty ? colors.surfaceAlt : colors.accent,
                    opacity: cell.future ? 0.4 : locked ? 0.5 : OPACITY[cell.level],
                    borderWidth: locked ? 1 : 0,
                    borderColor: colors.border,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-end' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text variant="caption" secondary>Less</Text>
        {([0, 1, 2, 3, 4] as Level[]).map((l) => (
          <View
            key={l}
            style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: l === 0 ? colors.surfaceAlt : colors.accent, opacity: OPACITY[l] }}
          />
        ))}
        <Text variant="caption" secondary>More</Text>
      </View>
    </View>
  );
}
