import type { RunRecoveryState } from '@langue-buster/shared';
import {
  CLASSIC_RUN_DEFAULT_SHORT_CYCLE_GAP,
  CLASSIC_RUN_DEFAULT_SHORT_CYCLE_RECENT_WINDOW,
} from '@langue-buster/shared';

export type RecoverySourceItem = Readonly<{ id: string }>;

export type ShortCycleRecoverySettings = Readonly<{
  resurfacingGap: number;
  recentWindow: number;
}>;

export type NextRecoverySourceSelection<TItem extends RecoverySourceItem> = Readonly<{
  sourceItem: TItem;
  recoveryState: RunRecoveryState;
  selectionReason: 'recovery_queue' | 'base_sequence';
}>;

export function createShortCycleRecoveryState(
  input: Partial<ShortCycleRecoverySettings> = {},
): RunRecoveryState {
  const settings = resolveSettings(input);

  return {
    pending: [],
    recentSourceItemIds: [],
    resurfacingGap: settings.resurfacingGap,
  };
}

export function scheduleShortCycleRecovery(
  state: RunRecoveryState | null | undefined,
  sourceItemId: string,
  failedSequence: number,
  input: Partial<ShortCycleRecoverySettings> = {},
): RunRecoveryState {
  const current = ensureRecoveryState(state, input);
  const pending = current.pending.filter(
    (entry: RunRecoveryState['pending'][number]) => entry.sourceItemId !== sourceItemId,
  );

  pending.push({
    sourceItemId,
    availableAfterSequence: failedSequence + current.resurfacingGap + 1,
    failureCount: (
      current.pending.find((entry: RunRecoveryState['pending'][number]) => entry.sourceItemId === sourceItemId)?.failureCount
      ?? 0
    ) + 1,
  });

  pending.sort(comparePendingEntries);

  return {
    ...current,
    pending,
  };
}

export function selectNextRecoverySource<TItem extends RecoverySourceItem>(input: Readonly<{
  pool: readonly TItem[];
  recoveryState?: RunRecoveryState | null;
  seed: number;
  sequence: number;
  settings?: Partial<ShortCycleRecoverySettings>;
}>): NextRecoverySourceSelection<TItem> {
  if (input.pool.length === 0) {
    throw new Error('Question source pool must contain at least one item.');
  }

  const state = ensureRecoveryState(input.recoveryState, input.settings);
  const dueRecoveryItem = selectDueRecoveryItem(input.pool, state, input.sequence);

  if (dueRecoveryItem) {
    return {
      sourceItem: dueRecoveryItem,
      recoveryState: recordServedSourceItem(state, dueRecoveryItem.id),
      selectionReason: 'recovery_queue',
    };
  }

  const pendingIds = new Set(state.pending.map((entry: RunRecoveryState['pending'][number]) => entry.sourceItemId));
  const recentIds = new Set(state.recentSourceItemIds);
  const preferredPool = input.pool.filter((item) => !pendingIds.has(item.id) && !recentIds.has(item.id));
  const relaxedPool = input.pool.filter((item) => !pendingIds.has(item.id));
  const candidatePool = preferredPool.length > 0
    ? preferredPool
    : relaxedPool.length > 0
      ? relaxedPool
      : input.pool;
  const fallback = selectFromCandidatePool(candidatePool, input.seed, input.sequence);

  if (!fallback) {
    throw new Error('Question source item could not be resolved.');
  }

  return {
    sourceItem: fallback,
    recoveryState: recordServedSourceItem(state, fallback.id),
    selectionReason: 'base_sequence',
  };
}

function ensureRecoveryState(
  state: RunRecoveryState | null | undefined,
  input: Partial<ShortCycleRecoverySettings> = {},
): RunRecoveryState {
  const settings = resolveSettings(input);

  if (!state) {
    return createShortCycleRecoveryState(settings);
  }

  return {
    pending: [...state.pending].sort(comparePendingEntries),
    recentSourceItemIds: [...state.recentSourceItemIds].slice(-settings.recentWindow),
    resurfacingGap: state.resurfacingGap > 0 ? state.resurfacingGap : settings.resurfacingGap,
  };
}

function recordServedSourceItem(state: RunRecoveryState, sourceItemId: string): RunRecoveryState {
  const uniqueRecent = [...state.recentSourceItemIds.filter((itemId: string) => itemId !== sourceItemId), sourceItemId];
  const recentWindow = Math.max(1, state.resurfacingGap);

  return {
    ...state,
    pending: state.pending.filter(
      (entry: RunRecoveryState['pending'][number]) => entry.sourceItemId !== sourceItemId,
    ),
    recentSourceItemIds: uniqueRecent.slice(-recentWindow),
  };
}

function selectDueRecoveryItem<TItem extends RecoverySourceItem>(
  pool: readonly TItem[],
  state: RunRecoveryState,
  sequence: number,
): TItem | null {
  const recentIds = new Set(state.recentSourceItemIds);
  const byId = new Map(pool.map((item) => [item.id, item]));

  for (const entry of state.pending) {
    if (entry.availableAfterSequence > sequence) {
      continue;
    }

    if (recentIds.has(entry.sourceItemId)) {
      continue;
    }

    const candidate = byId.get(entry.sourceItemId);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function selectFromCandidatePool<TItem extends RecoverySourceItem>(
  pool: readonly TItem[],
  seed: number,
  sequence: number,
): TItem | null {
  if (pool.length === 0) {
    return null;
  }

  const startIndex = normalizeSeed(seed + Math.imul(sequence + 1, 2654435761)) % pool.length;
  return pool[startIndex] ?? null;
}

function resolveSettings(input: Partial<ShortCycleRecoverySettings>): ShortCycleRecoverySettings {
  return {
    resurfacingGap: Math.max(1, input.resurfacingGap ?? CLASSIC_RUN_DEFAULT_SHORT_CYCLE_GAP),
    recentWindow: Math.max(1, input.recentWindow ?? CLASSIC_RUN_DEFAULT_SHORT_CYCLE_RECENT_WINDOW),
  };
}

function normalizeSeed(seed: number): number {
  return seed >>> 0;
}

function comparePendingEntries(
  left: RunRecoveryState['pending'][number],
  right: RunRecoveryState['pending'][number],
) {
  return left.availableAfterSequence - right.availableAfterSequence
    || right.failureCount - left.failureCount
    || left.sourceItemId.localeCompare(right.sourceItemId);
}
