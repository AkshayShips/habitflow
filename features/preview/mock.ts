/**
 * Placeholder data for screens whose backend is not built yet (Coach).
 * Replace each export with a real repository/hook when its phase lands.
 */
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
