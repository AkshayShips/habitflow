/**
 * Placeholder data for screens whose backend is not built yet (Coach, Journal, XP).
 * Replace each export with a real repository/hook when its phase lands.
 */
export const MOCK_XP = { level: 4, title: 'Steady', xp: 640, nextLevelXp: 800 };

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: string;
}

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_check', title: 'First step', description: 'Complete your first check-in.', icon: 'footsteps', unlocked: true },
  { id: 'streak_3', title: 'Three in a row', description: 'Reach a 3-day streak.', icon: 'flame', unlocked: true },
  { id: 'streak_7', title: 'One full week', description: 'Reach a 7-day streak.', icon: 'calendar', unlocked: true },
  { id: 'streak_30', title: 'Thirty days', description: 'Reach a 30-day streak.', icon: 'ribbon', unlocked: false, progress: '12 / 30 days' },
  { id: 'perfect_week', title: 'Perfect week', description: 'Finish every habit for 7 days.', icon: 'star', unlocked: false, progress: '4 / 7 days' },
  { id: 'five_habits', title: 'Building a routine', description: 'Keep 5 habits active.', icon: 'layers', unlocked: false, progress: '3 / 5 habits' },
  { id: 'journal_5', title: 'Reflective', description: 'Write 5 journal entries.', icon: 'book', unlocked: false, progress: '2 / 5 entries' },
  { id: 'comeback', title: 'Welcome back', description: 'Return after a few days away. No guilt.', icon: 'sparkles', unlocked: true },
];

export interface CoachMessage { id: string; role: 'user' | 'coach'; text: string }

export const COACH_STARTERS = [
  'Help me stay consistent',
  'I missed a few days',
  'Suggest a tiny new habit',
  'Review my week',
];

export const COACH_INTRO: CoachMessage = {
  id: 'intro',
  role: 'coach',
  text: 'Hi, I’m your coach. I can help you plan small habits, get back on track, or make sense of your week. What would help most right now?',
};

export const COACH_CANNED_REPLY =
  'That’s a really reasonable place to start. Pick the smallest version of this habit, something you could do in two minutes on your worst day, and attach it to something you already do. Want me to help you write it as a habit?';

export interface JournalEntry { id: string; date: string; mood: 1 | 2 | 3 | 4 | 5; text: string }

export const MOCK_JOURNAL: JournalEntry[] = [
  { id: 'j1', date: '2026-11-17', mood: 4, text: 'Morning walk felt easy today. Skipped reading but that’s okay.' },
  { id: 'j2', date: '2026-11-15', mood: 3, text: 'Busy day. Did the minimum and moved on.' },
];

export const MOODS = [
  { value: 1, label: 'Rough', icon: 'rainy-outline' },
  { value: 2, label: 'Low', icon: 'cloud-outline' },
  { value: 3, label: 'Okay', icon: 'partly-sunny-outline' },
  { value: 4, label: 'Good', icon: 'sunny-outline' },
  { value: 5, label: 'Great', icon: 'happy-outline' },
] as const;
