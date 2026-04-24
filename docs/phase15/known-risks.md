# Known Non-Blocking Risks

- Current soft-launch analytics are on-demand admin aggregations, not scheduled reports.
- Lesson-cluster visibility depends on event linkage quality and is weaker than item/topic visibility.
- Anti-cheat timing anomalies are log-only and may include false positives for ultra-fast taps.
- Soft-launch cohort gating is process-local config plus DB-backed tuning snapshots, not a distributed live-ops system.
- Early retention/tuning conclusions can be noisy with very small cohorts.
