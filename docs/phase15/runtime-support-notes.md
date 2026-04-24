# Runtime Support Notes

## Soft-launch gate
- `SOFT_LAUNCH_ENABLED=true` enables cohort gating.
- Allowed cohort sources:
  - `SOFT_LAUNCH_ALLOWED_USER_IDS`
  - `SOFT_LAUNCH_ALLOWED_TELEGRAM_USER_IDS`
- Admin allowlist remains a bypass for Admin routes.

## Operational settings
- Env defaults seed the initial runtime behavior.
- Active tuning is read from the latest persisted `soft_launch_settings_snapshots` record when present.
- Changed settings affect:
  - run starting hearts
  - wrong-answer heart loss
  - mastery thresholds
  - review intervals
  - weak resurfacing window

## Monitoring surfaces
- Admin analytics pages remain available for baseline queries.
- Admin `/soft-launch` is the Phase 15 operator surface.
- Anti-cheat anomaly log remains read-only in Admin `/anti-cheat`.

## Safe rollback
- Disable cohort entry: set `SOFT_LAUNCH_ENABLED=false`.
- Revert tuning by activating a previous snapshot payload.
- For content incidents, use the existing CMS archive/publish workflow rather than ad hoc DB edits.
