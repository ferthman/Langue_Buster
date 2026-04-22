import type {
  MasteryState,
  ReviewQueueItem,
  ReviewResurfacingReason,
  UserMastery,
} from '@langue-buster/shared';
import { userMasterySchema } from '@langue-buster/shared';

export type MasteryUpdateSignal = Readonly<{
  userId: string;
  sourceItemId: string;
  cefrLevel: UserMastery['cefrLevel'];
  correctness: boolean;
  occurredAt: string;
  timingMs?: number;
}>;

export type MasteryUpdateResult = Readonly<{
  mastery: UserMastery;
  previousState: MasteryState;
}>;

export type ScheduledMasteryEntry = Readonly<{
  mastery: UserMastery;
  priority: number;
}>;

const weakReviewMs = 2 * 60 * 60 * 1000;
const learningReviewMs = 12 * 60 * 60 * 1000;
const stableReviewMs = 3 * 24 * 60 * 60 * 1000;
const masteredReviewMs = 10 * 24 * 60 * 60 * 1000;

export function applyMasterySignal(
  existing: UserMastery | null,
  signal: MasteryUpdateSignal,
): MasteryUpdateResult {
  const previousState = existing?.masteryState ?? 'new';
  const nextSeenCount = (existing?.seenCount ?? 0) + 1;
  const nextCorrectCount = (existing?.correctCount ?? 0) + (signal.correctness ? 1 : 0);
  const nextWrongCount = (existing?.wrongCount ?? 0) + (signal.correctness ? 0 : 1);
  const nextSuccessStreak = signal.correctness ? (existing?.successStreak ?? 0) + 1 : 0;
  const nextFailureStreak = signal.correctness ? 0 : (existing?.failureStreak ?? 0) + 1;
  const nextState = resolveMasteryState({
    previousState,
    correctness: signal.correctness,
    successStreak: nextSuccessStreak,
    failureStreak: nextFailureStreak,
    correctCount: nextCorrectCount,
    wrongCount: nextWrongCount,
  });
  const nextReason = resolveResurfacingReason({
    previousState,
    nextState,
    correctness: signal.correctness,
    failureStreak: nextFailureStreak,
    hasExisting: existing !== null,
  });

  const mastery = userMasterySchema.parse({
    userId: signal.userId,
    sourceItemId: signal.sourceItemId,
    cefrLevel: signal.cefrLevel,
    masteryState: nextState,
    seenCount: nextSeenCount,
    correctCount: nextCorrectCount,
    wrongCount: nextWrongCount,
    successStreak: nextSuccessStreak,
    failureStreak: nextFailureStreak,
    lastSeenAt: signal.occurredAt,
    lastOutcome: signal.correctness ? 'correct' : 'wrong',
    lastTimingMs: signal.timingMs,
    averageTimingMs: calculateAverageTimingMs(existing, signal.timingMs),
    nextReviewAt: calculateNextReviewAt(nextState, signal.occurredAt),
    resurfacingReason: nextReason,
    createdAt: existing?.createdAt ?? signal.occurredAt,
    updatedAt: signal.occurredAt,
  });

  return {
    mastery,
    previousState,
  };
}

export function calculateNextReviewAt(state: MasteryState, occurredAt: string): string {
  const baseTime = new Date(occurredAt).getTime();
  const intervalMs = state === 'weak'
    ? weakReviewMs
    : state === 'learning'
      ? learningReviewMs
      : state === 'stable'
        ? stableReviewMs
        : state === 'mastered'
          ? masteredReviewMs
          : 0;

  return new Date(baseTime + intervalMs).toISOString();
}

export function scheduleReviewQueue(
  masteries: readonly UserMastery[],
  input: Readonly<{
    now: string;
    limit: number;
  }>,
): readonly ScheduledMasteryEntry[] {
  const withPriority = masteries.map((mastery) => ({
    mastery,
    priority: calculateReviewPriority(mastery, input.now),
  }));

  const due = withPriority
    .filter((entry) => isDue(entry.mastery, input.now))
    .sort((left, right) => compareScheduledEntries(left, right, input.now));

  if (due.length >= input.limit) {
    return due.slice(0, input.limit);
  }

  const backfill = withPriority
    .filter((entry) => !isDue(entry.mastery, input.now))
    .sort((left, right) => compareScheduledEntries(left, right, input.now));

  return [...due, ...backfill].slice(0, input.limit);
}

export function calculateReviewPriority(mastery: UserMastery, now: string): number {
  const basePriority = mastery.masteryState === 'weak'
    ? 100
    : mastery.masteryState === 'learning'
      ? 70
      : mastery.masteryState === 'new'
        ? 60
        : mastery.masteryState === 'stable'
          ? 40
          : 20;
  const overdueMs = new Date(now).getTime() - new Date(mastery.nextReviewAt).getTime();
  const overdueBonus = overdueMs > 24 * 60 * 60 * 1000 ? 20 : 0;
  const lastOutcomeBonus = mastery.lastOutcome === 'wrong' ? 10 : 0;

  return basePriority + overdueBonus + lastOutcomeBonus;
}

export function isWeakResurfacingCandidate(mastery: UserMastery, now: string): boolean {
  if (mastery.masteryState === 'weak' || mastery.failureStreak >= 2) {
    return true;
  }

  if (mastery.lastOutcome !== 'wrong') {
    return false;
  }

  const nextReviewTime = new Date(mastery.nextReviewAt).getTime();
  const shortWindowEnd = new Date(now).getTime() + weakReviewMs;
  return nextReviewTime <= shortWindowEnd;
}

function compareScheduledEntries(
  left: ScheduledMasteryEntry,
  right: ScheduledMasteryEntry,
  now: string,
): number {
  const leftDue = isDue(left.mastery, now);
  const rightDue = isDue(right.mastery, now);
  if (leftDue !== rightDue) {
    return leftDue ? -1 : 1;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  const reviewDelta = new Date(left.mastery.nextReviewAt).getTime() - new Date(right.mastery.nextReviewAt).getTime();
  if (reviewDelta !== 0) {
    return reviewDelta;
  }

  const lastSeenDelta = new Date(left.mastery.lastSeenAt).getTime() - new Date(right.mastery.lastSeenAt).getTime();
  if (lastSeenDelta !== 0) {
    return lastSeenDelta;
  }

  return left.mastery.sourceItemId.localeCompare(right.mastery.sourceItemId);
}

function isDue(mastery: UserMastery, now: string): boolean {
  return new Date(mastery.nextReviewAt).getTime() <= new Date(now).getTime();
}

function resolveMasteryState(input: {
  previousState: MasteryState;
  correctness: boolean;
  successStreak: number;
  failureStreak: number;
  correctCount: number;
  wrongCount: number;
}): MasteryState {
  if (input.correctness) {
    if (input.previousState === 'new' || input.previousState === 'weak') {
      return 'learning';
    }

    if (input.previousState === 'learning' && input.successStreak >= 3 && input.correctCount > input.wrongCount) {
      return 'stable';
    }

    if (input.previousState === 'stable' && input.successStreak >= 6 && input.wrongCount <= 2) {
      return 'mastered';
    }

    return input.previousState;
  }

  if (input.previousState === 'new') {
    return 'weak';
  }

  if (input.previousState === 'learning') {
    return input.failureStreak >= 2 ? 'weak' : 'learning';
  }

  if (input.previousState === 'stable' || input.previousState === 'mastered') {
    return input.failureStreak >= 2 ? 'weak' : 'learning';
  }

  return 'weak';
}

function resolveResurfacingReason(input: {
  previousState: MasteryState;
  nextState: MasteryState;
  correctness: boolean;
  failureStreak: number;
  hasExisting: boolean;
}): ReviewResurfacingReason {
  if (!input.hasExisting && input.correctness) {
    return 'new_item';
  }

  if (!input.correctness) {
    return input.failureStreak >= 2 || input.nextState === 'weak' ? 'weak_item' : 'recent_failure';
  }

  if (input.previousState === 'weak' && input.nextState === 'learning') {
    return 'streak_recovery';
  }

  return 'scheduled_review';
}

function calculateAverageTimingMs(existing: UserMastery | null, timingMs: number | undefined): number | undefined {
  if (timingMs === undefined) {
    return existing?.averageTimingMs;
  }

  if (existing?.averageTimingMs === undefined) {
    return timingMs;
  }

  const weightedTotal = existing.averageTimingMs * existing.seenCount;
  return Math.round((weightedTotal + timingMs) / (existing.seenCount + 1));
}
