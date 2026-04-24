# Daily Review Workflow

## Morning pass
1. Check `/admin/soft-launch`.
2. Export or copy the `launch`, `retention`, `content`, and `tuning` markdown summaries.
3. List the top 5 failed items and top weak topic/lesson clusters.

## Content triage
- Fix immediately:
  - wrong translation
  - broken distractor
  - ambiguous answer surface
  - obvious article/gender error
- Flag for later:
  - level fit questions
  - example polish
  - non-blocking phrasing improvements

## Runtime triage
- If `runtimeFailureCount > 0`, inspect event codes first.
- If anti-cheat anomalies rise, inspect severity/type distribution before changing thresholds.
- For repeatable client failures, create a bug-triage row and keep the cohort size unchanged until fixed.

## End-of-day record
- Record:
  - fixed items
  - remaining flagged items
  - whether tuning changed
  - known non-blocking issues still visible
