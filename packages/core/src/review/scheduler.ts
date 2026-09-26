import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { FsrsCard, ReviewRating } from "@lunara/schemas";

/**
 * Spaced repetition on FSRS (ts-fsrs, MIT). Cards are persisted as
 * `FsrsCard` (ISO strings) so the scheduler stays replaceable; this module
 * is the only place that knows the library.
 */
const params = generatorParameters({ enable_fuzz: false, maximum_interval: 365 });
const scheduler = fsrs(params);

const GRADE: Record<ReviewRating, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };

export function toLibraryCard(card: FsrsCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    ...(card.last_review ? { last_review: new Date(card.last_review) } : {}),
  };
}

export function fromLibraryCard(card: Card): FsrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function newReviewCard(now: Date): FsrsCard {
  return fromLibraryCard(createEmptyCard(now));
}

export function isDue(card: FsrsCard, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** Apply a rating; returns the next card state and the interval in days. */
export function gradeCard(card: FsrsCard, rating: ReviewRating, now: Date): { card: FsrsCard; intervalDays: number } {
  const { card: next } = scheduler.next(toLibraryCard(card), now, GRADE[rating]);
  return { card: fromLibraryCard(next), intervalDays: Math.max(0, Math.round((next.due.getTime() - now.getTime()) / 86_400_000)) };
}

/** Intervals the four ratings would produce, for display before the user chooses. */
export function previewIntervals(card: FsrsCard, now: Date): Record<ReviewRating, number> {
  const preview = scheduler.repeat(toLibraryCard(card), now);
  const days = (g: Grade) => Math.max(0, Math.round((preview[g].card.due.getTime() - now.getTime()) / 86_400_000));
  return { again: days(Rating.Again), hard: days(Rating.Hard), good: days(Rating.Good), easy: days(Rating.Easy) };
}

/** Retention evidence from a rating, for the learning_retention skill. */
export function retentionScore(rating: ReviewRating): number {
  return { again: 0, hard: 0.4, good: 0.75, easy: 1 }[rating];
}

export { State as ReviewState };
