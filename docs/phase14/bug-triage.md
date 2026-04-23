# Phase 14 Bug Triage

Canonical machine-readable triage data lives in `docs/phase14/bug-triage.json`.

| ID | Title | Severity | Area | Repro | Launch blocking | Status | Resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-001 | API lint blocked expected validation path | P1 | verification | always | yes | fixed | Removed stale lint debt in unavailable controllers, auth error normalization, run repository JSON parsing, and unused imports. |
| QA-002 | Active run restore/reopen path lacked regression coverage | P1 | miniapp | always | yes | fixed | Added Mini App test for `activeRunId` resume CTA after backend run verification. |
| QA-003 | Review stale question mismatch recovery lacked regression coverage | P1 | miniapp-review | always | yes | fixed | Added Mini App test for `review_question_mismatch` refetch recovery. |
| QA-004 | Launch bundle QA missed stricter content checks | P1 | content | always | yes | fixed | Added example completeness, approved-reference, linked-option, and duplicate-translation QA. |
| QA-005 | Game balance lacked deterministic smoke coverage | P2 | game-engine | always | no | fixed | Added fixed-seed balance simulation test. |
| QA-006 | Telegram dark theme variable application lacked regression coverage | P2 | miniapp-ux | always | no | fixed | Added Mini App dark theme variable test. |
| QA-007 | Soft-launch balance should be tuned with real user data | P3 | balance | variable | no | deferred | Keep current tuning for launch; revisit after Phase 15 usage data. |

## Current Launch-Blocking Status

No unresolved launch-blocking issues are recorded after the Phase 14 pass.
