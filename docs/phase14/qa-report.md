# Phase 14 QA Report

## Scope

Phase 14 audited launch readiness across functional flows, launch content, game balance, UX states, and verification health. No Phase 15 launch operations, new product systems, CMS redesign, analytics expansion, or gameplay redesign were started.

## Functional QA

Audited surfaces:

- Auth bootstrap: stored session, invalid session fallback, Telegram auth, unsupported browser state.
- Run flow: start, answer, move lock/unlock, illegal move, finish/result, active run resume.
- Review flow: empty queue, due item, answer feedback, stale question mismatch recovery.
- CMS workflow: import validate/apply, vocab/topic/lesson edits, approve/archive, QA flags, audit history.
- Session restore and Telegram reopen: local `activeRunId` plus backend run confirmation.

Findings and fixes:

- Fixed the validation blocker from API lint debt by cleaning stale lint issues in controllers, auth normalization, and run repository mapping.
- Added Mini App coverage for active run resume after reopen.
- Added Mini App coverage for stale review question recovery.
- No unresolved launch-blocking functional defects remain in the triage artifact.

## Content QA

Launch content source: `phase11LaunchBundle`.

Measured content status:

- Total approved vocab items: 336.
- A1 items: 168.
- A2 items: 168.
- Topics: 12.
- Lessons: 20.
- Distractor sets: 336.
- Example coverage: 336 / 336.
- Noun-like article/gender reviewed items: 208.
- High-risk duplicate Russian translation groups: 0.
- Blocking launch QA issues: 0.

Added checks:

- Complete French/Russian examples.
- Approved topic, lesson, level, content, and distractor references.
- Linked distractor option labels match linked content items.
- High-risk duplicate Russian translation detection.

No content data changes were required; stricter QA passed on the existing launch bundle.

## Balance QA

Measured with fixed seeds `10000-10039`:

- Median moves: 80.
- Average moves: 66.4.
- Minimum moves: 17.
- Maximum moves: 80.
- Average score: 552.38.
- Average cleared lines: 25.3.
- Runs with combo hits: 39 / 40.
- Natural run-over before safety cap: 19 / 40.

Conclusion: current game-engine tuning is acceptable for launch-readiness. No scoring constants, heart counts, combo rules, board size, or piece catalog were changed.

## UX QA

Audited surfaces:

- Onboarding and placement clarity.
- Home priority and active run resume.
- Classic Run loading/terminal states.
- Review empty/error/stale recovery states.
- Profile/basic shell navigation.
- Telegram dark theme CSS variable application.
- Tap-target-oriented button/option surfaces.

Findings and fixes:

- Added regression coverage for Telegram dark theme application.
- Added regression coverage for reopen/resume and review mismatch recovery.
- No blocking copy, dark-mode, tap target, or error-state defects were found during this pass.

## Verification

Commands run during Phase 14:

- `corepack pnpm --filter @langue-buster/content-core test`
- `corepack pnpm --filter @langue-buster/content-core typecheck`
- `corepack pnpm --filter @langue-buster/content-core build`
- `corepack pnpm --filter @langue-buster/game-engine test`
- `corepack pnpm --filter @langue-buster/game-engine typecheck`
- `corepack pnpm --filter @langue-buster/miniapp test`
- `corepack pnpm --filter @langue-buster/miniapp typecheck`
- `corepack pnpm --filter @langue-buster/miniapp build`
- `corepack pnpm --filter @langue-buster/api test`
- `corepack pnpm --filter @langue-buster/api typecheck`
- `corepack pnpm --filter @langue-buster/api build`
- `corepack pnpm --filter @langue-buster/api lint`
- `corepack pnpm --filter @langue-buster/admin test`
- `corepack pnpm --filter @langue-buster/admin build`
- `corepack pnpm --filter @langue-buster/admin typecheck`
- `corepack pnpm --filter @langue-buster/game-engine build`

Note: `@langue-buster/admin typecheck` expects Next-generated `.next/types`; it failed before `next build` generated those files, then passed after `@langue-buster/admin build`.

## Deferred

- Human playtest tuning remains for Phase 15 soft-launch operations.
- No new CMS workflows were added; Phase 14 only verified existing CMS publishing behavior.
- No analytics dashboard expansion was started.
- No new content population was added beyond stricter QA on the existing launch pack.
