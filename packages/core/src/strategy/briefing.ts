import type { QuickPuzzle } from "@lunara/schemas";

/** Deterministic daily selection: same user, same day → same items, no model call. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickForDay<T>(items: readonly T[], uid: string, date: string, salt = ""): T | null {
  if (items.length === 0) return null;
  return items[hashString(`${uid}:${date}:${salt}`) % items.length] ?? null;
}

export const STRATEGIC_QUESTIONS: readonly string[] = [
  "What is one decision you are treating as urgent that is actually only loud? What would change if you gave it a week?",
  "Name a current plan of yours. What is the single assumption it depends on most, and how would you find out cheaply if it is false?",
  "Who benefits if you do nothing this month? What does that tell you about where the pressure to act is coming from?",
  "Think of a recent disagreement. What evidence would have changed your mind, and did you ask for it?",
  "What would your strongest competitor or critic say your plan is missing? Write their sentence, not yours.",
  "Which of your commitments has the least reversible consequences? Is it getting the most careful thought?",
  "Pick a goal. Describe the world in which you achieved it and it still turned out to be the wrong goal.",
  "What information are you waiting for before deciding? What would you decide if it never arrived?",
  "Which recent success might have been luck? What would you have done differently if the dice had fallen the other way?",
  "Where are you optimising a number instead of the thing the number was supposed to measure?",
  "What is the cheapest experiment that would tell you whether your current approach is working?",
  "If you had to hand your main project to someone else tomorrow, what would they need to know that is only in your head?",
  "What is a belief you hold about your field that you have never seen tested?",
  "Which stakeholder have you not spoken to recently whose reaction could derail the plan?",
];

export function puzzleForDay(bank: readonly QuickPuzzle[], uid: string, date: string): QuickPuzzle | null {
  return pickForDay(bank, uid, date, "puzzle");
}

export function questionForDay(uid: string, date: string): string {
  return pickForDay(STRATEGIC_QUESTIONS, uid, date, "question") ?? STRATEGIC_QUESTIONS[0]!;
}
