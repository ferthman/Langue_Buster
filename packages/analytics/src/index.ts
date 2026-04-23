export const analyticsEventNames = {
  appBootstrapStarted: 'app_bootstrap_started',
  appBootstrapSucceeded: 'app_bootstrap_succeeded',
  appBootstrapFailed: 'app_bootstrap_failed',
  authBootstrapSucceeded: 'auth_bootstrap_succeeded',
  authBootstrapFailed: 'auth_bootstrap_failed',
  onboardingStarted: 'onboarding_started',
  onboardingCompleted: 'onboarding_completed',
  onboardingSkipped: 'onboarding_skipped',
  placementStarted: 'placement_started',
  placementCompleted: 'placement_completed',
  homeOpened: 'home_opened',
  runScreenOpened: 'run_screen_opened',
  reviewScreenOpened: 'review_screen_opened',
  profileOpened: 'profile_opened',
  levelSelected: 'level_selected',
  lessonSelected: 'lesson_selected',
  lessonCompleted: 'lesson_completed',
  runStarted: 'run_started',
  questionShown: 'question_shown',
  answerSubmitted: 'answer_submitted',
  answerCorrect: 'answer_correct',
  answerWrong: 'answer_wrong',
  moveSubmitted: 'move_submitted',
  moveRejected: 'move_rejected',
  moveAccepted: 'move_accepted',
  runCompleted: 'run_completed',
  runAbandoned: 'run_abandoned',
  reviewQueueOpened: 'review_queue_opened',
  reviewAnswerSubmitted: 'review_answer_submitted',
  reviewAnswerCorrect: 'review_answer_correct',
  reviewAnswerWrong: 'review_answer_wrong',
  retryClicked: 'retry_clicked',
  userVisibleFailure: 'user_visible_failure',
  adminImportValidated: 'admin_import_validated',
  adminImportApplied: 'admin_import_applied',
} as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[keyof typeof analyticsEventNames];

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return Object.values(analyticsEventNames).includes(value as AnalyticsEventName);
}

export function createFrontendAnalyticsEvent<T extends Record<string, unknown>>(
  event: T,
): T & { source: 'frontend' } {
  return {
    ...event,
    source: 'frontend',
  };
}

export function createBackendAnalyticsEvent<T extends Record<string, unknown>>(
  event: T,
): T & { source: 'backend' } {
  return {
    ...event,
    source: 'backend',
  };
}
