import type { LaunchLevelId } from '@langue-buster/shared';
import { createContext, useContext, useMemo, useState } from 'react';

import {
  readActiveRunId,
  readFocusLevel,
  readOnboardingSeen,
  writeActiveRunId,
  writeFocusLevel,
  writeOnboardingSeen,
} from './storage';

type PreferencesContextValue = {
  onboardingSeen: boolean;
  focusLevel: LaunchLevelId | null;
  activeRunId: string | null;
  setOnboardingSeen(value: boolean): void;
  setFocusLevel(value: LaunchLevelId): void;
  setActiveRunId(value: string | null): void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [onboardingSeen, setOnboardingSeenState] = useState(readOnboardingSeen);
  const [focusLevel, setFocusLevelState] = useState<LaunchLevelId | null>(readFocusLevel);
  const [activeRunId, setActiveRunIdState] = useState<string | null>(readActiveRunId);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      onboardingSeen,
      focusLevel,
      activeRunId,
      setOnboardingSeen(value) {
        setOnboardingSeenState(value);
        writeOnboardingSeen(value);
      },
      setFocusLevel(value) {
        setFocusLevelState(value);
        writeFocusLevel(value);
      },
      setActiveRunId(value) {
        setActiveRunIdState(value);
        writeActiveRunId(value);
      },
    }),
    [activeRunId, focusLevel, onboardingSeen],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences must be used inside PreferencesProvider.');
  }

  return value;
}
