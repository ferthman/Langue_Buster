import { describe, expect, it } from 'vitest';

import {
  createShortCycleRecoveryState,
  scheduleShortCycleRecovery,
  selectNextRecoverySource,
} from './short-cycle-recovery.js';

const pool = [
  { id: 'apple' },
  { id: 'bread' },
  { id: 'water' },
  { id: 'cat' },
  { id: 'dog' },
  { id: 'house' },
  { id: 'book' },
] as const;

describe('short-cycle recovery queue', () => {
  it('re-surfaces a failed item after five new prompts', () => {
    let recoveryState = createShortCycleRecoveryState();
    recoveryState = scheduleShortCycleRecovery(recoveryState, 'apple', 0);

    const seen: string[] = [];

    for (let sequence = 1; sequence <= 6; sequence += 1) {
      const next = selectNextRecoverySource({
        pool,
        recoveryState,
        seed: 7,
        sequence,
      });

      seen.push(next.sourceItem.id);
      recoveryState = next.recoveryState;
    }

    expect(seen.slice(0, 5)).not.toContain('apple');
    expect(seen[5]).toBe('apple');
  });

  it('keeps fallback selection deterministic for the same seed and sequence', () => {
    const first = selectNextRecoverySource({
      pool,
      recoveryState: createShortCycleRecoveryState(),
      seed: 99,
      sequence: 0,
    });
    const second = selectNextRecoverySource({
      pool,
      recoveryState: createShortCycleRecoveryState(),
      seed: 99,
      sequence: 0,
    });

    expect(first.sourceItem.id).toBe(second.sourceItem.id);
    expect(first.selectionReason).toBe('base_sequence');
  });

  it('suppresses duplicate pending entries and prioritizes the most overdue failed item', () => {
    let recoveryState = createShortCycleRecoveryState();
    recoveryState = scheduleShortCycleRecovery(recoveryState, 'apple', 0);
    recoveryState = scheduleShortCycleRecovery(recoveryState, 'apple', 1);
    recoveryState = scheduleShortCycleRecovery(recoveryState, 'bread', 0);

    expect(recoveryState.pending).toHaveLength(2);
    expect(recoveryState.pending.find((entry) => entry.sourceItemId === 'apple')?.failureCount).toBe(2);

    const next = selectNextRecoverySource({
      pool,
      recoveryState: {
        ...recoveryState,
        pending: [
          { sourceItemId: 'bread', availableAfterSequence: 3, failureCount: 1 },
          { sourceItemId: 'apple', availableAfterSequence: 3, failureCount: 2 },
        ],
      },
      seed: 5,
      sequence: 3,
    });

    expect(next.selectionReason).toBe('recovery_queue');
    expect(next.sourceItem.id).toBe('apple');
  });
});
