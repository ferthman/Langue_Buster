import type { LaunchLevelId } from '@langue-buster/shared';

const ONBOARDING_KEY = 'langue-buster.onboardingSeen';
const FOCUS_LEVEL_KEY = 'langue-buster.focusLevel';
const ACTIVE_RUN_KEY = 'langue-buster.activeRunId';

export function readOnboardingSeen() {
  return readStorage(ONBOARDING_KEY) === 'true';
}

export function writeOnboardingSeen(value: boolean) {
  writeStorage(ONBOARDING_KEY, String(value));
}

export function readFocusLevel(): LaunchLevelId | null {
  const value = readStorage(FOCUS_LEVEL_KEY);
  return value === 'A1' || value === 'A2' ? value : null;
}

export function writeFocusLevel(value: LaunchLevelId) {
  writeStorage(FOCUS_LEVEL_KEY, value);
}

export function readActiveRunId() {
  return readStorage(ACTIVE_RUN_KEY);
}

export function writeActiveRunId(value: string | null) {
  if (value) {
    writeStorage(ACTIVE_RUN_KEY, value);
    return;
  }

  removeStorage(ACTIVE_RUN_KEY);
}

function readStorage(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, value);
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(key);
}
