# Soft Launch Runbook

## Scope
- Closed soft-launch cohort only.
- Launch levels: `A1`, `A2`.
- Product surfaces: Mini App gameplay/review, Admin CMS, analytics, anti-cheat.

## Daily operator loop
1. Open Admin `/soft-launch`.
2. Review `Live 24h` KPIs:
   - onboarding completion
   - first run start / finish
   - answer accuracy
   - review adoption
   - runtime failures
3. Review `Retention 7d` and replay signal.
4. Inspect `Top failed / weak items`.
5. For obvious content defects:
   - open the vocab item from the soft-launch table
   - patch the item in CMS
   - archive/approve only through the existing editorial workflow
   - add or resolve QA flags as needed
6. Review recent anti-cheat anomalies and confirm they are benign or isolated.
7. Record any tuning decision with a new soft-launch settings snapshot note.

## Hotfix path
1. Add QA flag from the soft-launch page if the item needs editor follow-up.
2. Open the item in CMS.
3. Fix copy, translation, distractor, or status issue.
4. Re-publish via existing CMS flow.
5. Re-check the item in the next daily soft-launch report window.

## Tuning policy
- Change only one or two knobs at a time.
- Every tuning update must create a new active settings snapshot with a note.
- Prefer daily review plus cohort observation over same-day repeated tuning.

## Stop conditions
- Runtime failure cluster on core auth/run/review flow.
- Major content cluster producing repeated wrong answers or ambiguity.
- Anti-cheat anomaly spike that looks non-benign.
- Cohort confusion where the core loop requires manual explanation.
