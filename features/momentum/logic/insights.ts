import { addDays, type DateStr } from '@/features/habits/logic/dates';
import { summarize, weekdayWeekendSplit } from './patterns';
import type { Confidence, Insight, MHabit, MLog } from './types';

const pct = (r: number) => `${Math.round(r * 100)}%`;

/** Sample-size qualification: how many scheduled days the claim rests on. */
export function confidenceFor(n: number): Confidence {
  return n >= 40 ? 'high' : n >= 20 ? 'medium' : 'low';
}

/**
 * Deterministic, explainable insights. Every one states the numbers it is based on, says how much data
 * is behind it, and is worded as an observation, never as a reason ("we don't know why").
 * Returns nothing if there isn't enough data; we don't invent patterns.
 */
export function generateInsights(habits: MHabit[], logs: MLog[], today: DateStr): Insight[] {
  const out: Insight[] = [];
  for (const h of habits.filter((x) => x.archivedAt === null)) {
    // 1) Weekend vs weekday gap, last 8 weeks. Needs real samples on both sides.
    const split = weekdayWeekendSplit(h, logs, today, 56);
    const we = split.weekend;
    const wd = split.weekday;
    if (we.rate !== null && wd.rate !== null && we.scheduled - we.skipped >= 6 && wd.scheduled - wd.skipped >= 15) {
      const gap = wd.rate - we.rate;
      const n = we.scheduled + wd.scheduled;
      if (Math.abs(gap) >= 0.25) {
        const weekendLower = gap > 0;
        out.push({
          id: `weekend-gap:${h.id}`,
          habitId: h.id,
          observation: weekendLower
            ? `${h.name} happens less often on weekends than on weekdays.`
            : `${h.name} happens more often on weekends than on weekdays.`,
          evidence: `Last 8 weeks: ${we.done} of ${we.scheduled - we.skipped} weekend days (${pct(we.rate)}) vs ${wd.done} of ${wd.scheduled - wd.skipped} weekdays (${pct(wd.rate)}).`,
          sampleSize: n,
          confidence: confidenceFor(n),
          suggestedAction: weekendLower
            ? 'If you want, you could try a smaller version on weekends. This is a pattern in your log, not a reason.'
            : 'Weekends seem to suit this habit. You could schedule your most important sessions then.',
        });
      }
    }

    // 2) Recent trend: last 28 days vs the 28 before.
    const recent = summarize(h, logs, addDays(today, -28), addDays(today, -1), today);
    const prior = summarize(h, logs, addDays(today, -56), addDays(today, -29), today);
    if (recent.rate !== null && prior.rate !== null && recent.scheduled - recent.skipped >= 14 && prior.scheduled - prior.skipped >= 14) {
      const delta = recent.rate - prior.rate;
      const n = recent.scheduled + prior.scheduled;
      if (delta >= 0.15) {
        out.push({
          id: `trend-up:${h.id}`,
          habitId: h.id,
          observation: `${h.name} has been going better lately.`,
          evidence: `Last 4 weeks: ${pct(recent.rate)} of scheduled days, up from ${pct(prior.rate)} in the 4 weeks before.`,
          sampleSize: n,
          confidence: confidenceFor(n),
        });
      } else if (delta <= -0.2) {
        out.push({
          id: `trend-down:${h.id}`,
          habitId: h.id,
          observation: `${h.name} has been harder to fit in recently.`,
          evidence: `Last 4 weeks: ${pct(recent.rate)} of scheduled days, down from ${pct(prior.rate)} in the 4 weeks before.`,
          sampleSize: n,
          confidence: confidenceFor(n),
          suggestedAction: 'Consider a lighter target or fewer days for a while. You choose; nothing changes unless you edit it.',
        });
      }
    }
  }
  // Most data-backed first.
  return out.sort((a, b) => b.sampleSize - a.sampleSize).slice(0, 5);
}
