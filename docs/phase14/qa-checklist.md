# Phase 14 QA Checklist

Use this checklist as the launch-readiness working sheet. Mark each row `pass`, `fail`, `blocked`, or `deferred`, and keep notes reproducible.

## Functional QA

| ID | Area | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| FQA-01 | Auth bootstrap | Launch with valid stored bearer token and call `/auth/session`. | Session restores and user reaches gated app flow. | pass | Covered by Mini App bootstrap test. |
| FQA-02 | Auth fallback | Launch with stale stored token and Telegram `initData`. | Stale token is rejected, `/auth/telegram` establishes fresh session. | pass | Covered by Mini App bootstrap test. |
| FQA-03 | Unsupported browser | Launch without valid session or Telegram auth. | User-safe unsupported state with retry. | pass | Existing Mini App state covered. |
| FQA-04 | Run start | From Home, start Classic Run for selected A1/A2 focus level. | Backend creates server-owned run and app navigates to `/run/:runId`. | pass | Covered by existing run/API smoke paths. |
| FQA-05 | Run answer | Submit correct and wrong answers. | Correct unlocks move; wrong decrements hearts without client scoring. | pass | Covered by API run service tests. |
| FQA-06 | Move locked | Try move before correct answer. | Backend rejects invalid state. | pass | Covered by Phase 7/13 API tests. |
| FQA-07 | Illegal move | Submit illegal placement. | Backend rejects and anomaly logging remains intact. | pass | Covered by anti-cheat tests. |
| FQA-08 | Finish/result | Finish or terminal run, then fetch result. | Persisted result is returned; score is server recomputed. | pass | Covered by API tests. |
| FQA-09 | Active run resume | Reopen with local `activeRunId`. | Home shows resume CTA only if backend run is active/awaiting move. | pass | Added Phase 14 Mini App test. |
| FQA-10 | Review queue empty | Open Review with no due items. | Empty state appears, no fake cards. | pass | Covered by Mini App test. |
| FQA-11 | Review answer | Answer review card. | Backend evaluates, mastery updates, UI advances after feedback. | pass | Covered by Mini App test. |
| FQA-12 | Review stale mismatch | Submit stale review question. | UI refetches queue and recovers. | pass | Added Phase 14 Mini App test. |
| FQA-13 | CMS import validate/apply | Validate and apply Phase 11 bundle through admin API. | Invalid bundles fail; valid bundle persists transactionally. | pass | Covered by content-admin tests and launch bundle validation. |
| FQA-14 | CMS publish/archive | Edit status through workflow. | Invalid publish blocked; archive explicit and audited. | pass | Covered by content-admin tests. |
| FQA-15 | Admin history | Mutate content and open history. | Audit row visible with action and actor. | pass | Covered by content-admin/admin tests. |

## Content QA

| ID | Area | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| CQA-01 | Schema validity | Parse Phase 11 bundle as `EditorialImportBundle`. | Zero schema errors. | pass | 336 items validated. |
| CQA-02 | Translation completeness | Check every item `translationRu`. | No blank/TODO/TBD/XXX translations. | pass | Enforced in launch QA. |
| CQA-03 | Example completeness | Check every item example FR/RU. | 336/336 have complete examples. | pass | Added Phase 14 launch QA. |
| CQA-04 | Distractor ambiguity | Generate RU->FR questions for all items. | One correct answer, no duplicate normalized option labels. | pass | Existing and extended launch QA. |
| CQA-05 | Distractor linkage | Check option labels against linked item labels. | No linked option mismatch. | pass | Added Phase 14 launch QA. |
| CQA-06 | Article/gender | Check noun-like items. | 208 noun-like items have article and gender; non-nouns do not. | pass | Enforced in launch QA. |
| CQA-07 | Lesson/topic refs | Check lessons, levels, topics, content refs. | All referenced entities exist and are approved. | pass | Added Phase 14 launch QA. |
| CQA-08 | High-risk duplicate RU translations | Group by CEFR/POS/item type/translation. | Zero high-risk duplicate groups. | pass | Added Phase 14 launch QA. |

## Balance QA

| ID | Area | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| BQA-01 | Determinism | Simulate fixed seeds 10000-10039. | Same metrics on repeat runs. | pass | Added game-engine balance smoke test. |
| BQA-02 | Run duration | Greedy legal-placement simulation. | Median not trivially short. | pass | Median 80 moves, average 66.4, min 17. |
| BQA-03 | Line clears | Simulated runs clear lines. | Average clears > 0. | pass | Average 25.3 line clears. |
| BQA-04 | Combo feel | Simulated runs trigger combos. | Combo hits occur but do not replace placement score. | pass | 39/40 runs had combo hits. |
| BQA-05 | Run-over distribution | Simulated runs can terminate before safety cap. | Some, not all, runs end naturally. | pass | 19/40 run-over before cap. |
| BQA-06 | Heart penalty | Review product rule. | 3 hearts remains clear and understandable. | pass | No change recommended before soft launch. |

## UX QA

| ID | Area | Steps | Expected | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| UXQA-01 | Onboarding clarity | Open first-run onboarding. | Explains answer -> move -> review loop in Russian. | pass | Existing Mini App copy reviewed. |
| UXQA-02 | Placement clarity | Open placement route. | A1/A2 chooser is clear and minimal. | pass | Existing flow matches Phase 9 scope. |
| UXQA-03 | Home priority | Open Home. | Start run, review, focus level, resume are visible. | pass | Resume CTA now covered by test. |
| UXQA-04 | Run readability | Open active run. | Hearts/score/question/board/tray are visible and server-owned. | pass | Existing run screen covered by smoke tests. |
| UXQA-05 | Review empty/error | Open empty review and stale mismatch. | Empty/recovery states are user-safe. | pass | Added stale mismatch test. |
| UXQA-06 | Dark theme | Launch with Telegram dark params. | Root theme and Telegram CSS vars are applied. | pass | Added Phase 14 Mini App test. |
| UXQA-07 | Tap targets | Inspect primary CTAs and option buttons. | Large button styles used, no hover-only dependency. | pass | CSS reviewed; no blocking issue found. |
| UXQA-08 | Error messaging | Force API unreachable. | Russian user-safe error is shown. | pass | Existing Mini App test. |
