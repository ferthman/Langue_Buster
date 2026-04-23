# Phase 14 Balance Notes

## Method

Balance observations use the deterministic game engine only. The smoke simulation runs seeds `10000` through `10039`, repeatedly choosing the legal placement that prioritizes line clears, then score, then top-left deterministic tie-breakers. The simulation is not a human skill model; it is a regression guard for obviously broken pacing.

## Measured Results

| Metric | Value |
| --- | ---: |
| Simulated seeds | 40 |
| Median moves | 80 |
| Average moves | 66.4 |
| Minimum moves | 17 |
| Maximum moves | 80 |
| Average score | 552.38 |
| Average cleared lines | 25.3 |
| Runs with combo hits | 39 / 40 |
| Natural run-over before safety cap | 19 / 40 |

## Observations

- Run duration is not trivially short under legal-placement play. The median hits the 80-move simulation cap, while the minimum natural run length is 17 moves.
- Piece pacing is playable for launch. The current catalog produces enough legal-placement variety that deterministic play can both continue for long runs and naturally fail in some seeds.
- Line clears are frequent enough to make the board state dynamic. Average cleared lines are 25.3 per simulation.
- Combo rewards are visible but not the only score source. Combos appear in 39 of 40 simulations, while placement and line-clear points still carry the score curve.
- The 3-heart answer penalty remains understandable and should not be changed before soft launch. No evidence in this pass indicates penalty severity is a launch blocker.

## Adjustments

No scoring or piece-catalog tuning was changed in Phase 14. The current balance is acceptable for a first launch pass, and changing constants without human play data would be higher risk than keeping deterministic coverage and tuning after soft launch observations.

## Follow-Up After Phase 15 Starts

- Compare real first-session run duration against the simulation bands.
- Watch abandonment before first move and before first line clear.
- Review answer timing and wrong-answer frequency before changing hearts or combo constants.
- Revisit greedy simulation strategy if the game engine adds new piece shapes or board sizes.
