export const appEvents = {
  appOpened: 'app_opened',
  authSuccess: 'auth_success',
  onboardingStarted: 'onboarding_started',
  placementTestStarted: 'placement_test_started',
  placementTestCompleted: 'placement_test_completed',
  levelSelected: 'level_selected',
  runStarted: 'run_started',
  runFinished: 'run_finished',
} as const;

export type AppEventName = (typeof appEvents)[keyof typeof appEvents];

