# Implementation Plan - Version 2.0 (Post-MVP)

Operational plan for the **post-MVP evolution** of the French Learning Telegram Mini App.

This file is the successor to the MVP execution plan. It assumes the MVP already exists in a usable form with:
- Telegram auth;
- Russian UI;
- A1/A2 launch content;
- Classic Run;
- baseline mastery + review queue;
- admin CMS;
- analytics and anti-cheat baseline.

Version 2.0 is **not** a rewrite.
It is the first serious product expansion after the MVP proves that the core loop is understandable and replayable.

---

## 0. Purpose of v2.0

The goal of v2.0 is to turn the MVP from a promising prototype into a **repeatable habit product**.

That means improving four things at once:
- the puzzle loop must feel better;
- the learning loop must feel smarter;
- the progression loop must create return behavior;
- the product must become easier to operate and scale.

If MVP proves the core idea, then v2.0 must prove that users come back **because the game-learning loop feels rewarding**, not because they were forced through a novelty spike.

---

## 1. What v2.0 is optimizing for

### Primary product goals
- raise D1 and D7 retention;
- increase average runs per active user;
- improve first-week vocabulary recall for weak items;
- reduce frustration from harsh failure states;
- deepen the sense of progression without bloating the app.

### Primary business goals
- create a product foundation strong enough for:
  - B1 expansion;
  - light monetization experiments;
  - events / missions / live-ops;
  - stronger referral loops later.

### Primary engineering goals
- harden contracts and content operations;
- reduce gameplay/UI drift;
- support faster iteration on balance, cards, and content;
- keep domain logic deterministic and testable.

---

## 2. Decisions carried into v2.0

These are the main decisions this v2.0 plan assumes.

### 2.1 Core board loop stays
- board remains **8x8**;
- tray remains **3 answer-piece slots**;
- move unlocking still depends on correct answer;
- game ends when hearts reach zero or no legal placements remain.

### 2.2 Hearts model changes from MVP baseline
The MVP documentation used **3 hearts** as the recommended penalty model.
For v2.0, the default should move to **5 hearts** with balancing instrumentation.

Reason:
- 3 hearts is clean for a first version, but it is probably too punishing for a hybrid product where players are learning and puzzling at the same time.
- the newer front-facing concept explicitly argues that **5 hearts** is the more balanced starting point, with 4-6 being the healthy range.

### 2.3 Repetition becomes more explicit
The MVP already includes review and weak-word resurfacing.
In v2.0, the in-run repetition rule becomes a visible and deterministic mechanic:
- wrong answer -> item enters short-cycle recovery queue;
- the item can reappear after roughly **5 new words**;
- later balancing can test 3 / 5 / adaptive spacing variants.

### 2.4 UI direction stays stable
Do not redesign the whole visual identity in v2.0.
Polish the layout, feedback, and clarity.
Do **not** burn time on a cosmetic rebrand when the real work is retention.

---

## 3. Definition of v2.0 scope

### In scope
- gameplay feel upgrades;
- answer flow redesign for better readability and faster reactions;
- 5-heart balancing pass;
- in-run repetition queue v2;
- better mastery feedback;
- richer progression layer;
- daily / weekly missions;
- streak logic improvements;
- expanded review mode;
- A1/A2 content scaling and cleanup;
- B1 preparation and controlled beta entry;
- analytics enrichment;
- content QA tooling improvements;
- run resume / recovery improvements;
- leaderboard/events groundwork if retention supports it.

### Out of scope
- real-time multiplayer;
- clans / guilds;
- full C1/C2 launch;
- voice recognition and speaking scoring;
- deep social graph;
- complicated hard-currency economy;
- full App Store / Google Play rewrite;
- massive art overhaul for style points.

---

## 4. Product principles for v2.0

### 4.1 Do not lose the simplicity of the MVP
If v2.0 adds five systems but makes the first run harder to understand, it is worse, not better.

### 4.2 Retention beats feature vanity
A cute feature with no measurable return behavior is decoration.

### 4.3 Learning must stay inside the action loop
Do not drift into a product where the puzzle is optional and the learning happens somewhere else.

### 4.4 Content quality beats content volume
A bigger broken course is just a bigger broken course.

### 4.5 Frontend polish must serve gameplay clarity
Animations, popups, and effects should make decisions clearer and more satisfying - not slower.

---

## 5. v2.0 release thesis

Version 2.0 should feel like this:
- fewer unfair deaths;
- more satisfying feedback;
- weak words come back at the right time;
- the player clearly sees growth;
- there is a reason to return tomorrow;
- the app still feels lightweight inside Telegram.

If a user finishes a run and thinks:
> “Okay, one more.”
that is good.

If they finish a run and think:
> “That was homework in camouflage.”
then the product still has a hole in it.

---

## 6. Main workstreams

## Workstream A - Gameplay Feel 2.0
**Goal:** make the core run more satisfying, readable, and less punishing.

### Tasks
- [ ] Move to default **5-heart** run model
- [ ] Add balancing config for 4 / 5 / 6-heart experiments
- [ ] Improve piece selection and placement preview
- [ ] Improve answer-to-placement transition speed
- [ ] Add stronger correct / wrong / combo feedback states
- [ ] Improve empty-board and no-move readability
- [ ] Improve game-over clarity by showing exact fail reason
- [ ] Add smoother end-of-run summary animation
- [ ] Tune board difficulty curve through seed balancing
- [ ] Add pause / recover / reopen-safe run state handling

### Deliverables
- [ ] gameplay feel checklist
- [ ] updated balancing config
- [ ] revised fail-state UX
- [ ] clearer session summary payload

### Exit criteria
- first-time and repeat users understand what happened in every failed run;
- answer -> placement -> score feedback feels immediate;
- heart loss no longer feels like random punishment.

---

## Workstream B - Learning Loop 2.0
**Goal:** make wrong answers useful instead of merely painful.

### Tasks
- [ ] Implement **short-cycle repetition queue** for recent mistakes
- [ ] Default resurfacing rule: reintroduce weak item after ~5 new prompts
- [ ] Add item memory state `recent_error`
- [ ] Separate mistake sources:
  - [ ] first-time miss
  - [ ] repeated miss
  - [ ] article/gender miss
  - [ ] speed/impulse miss
- [ ] Add answer latency capture to learning model
- [ ] Show “word will return soon” micro-feedback after mistakes
- [ ] Add end-of-run weak-word recap
- [ ] Add lightweight “learned / still weak” state chips in run summary
- [ ] Add focused retry mini-flow for 3-5 worst items from run
- [ ] Improve review scheduler to distinguish short-cycle recovery from long-interval review

### Deliverables
- [ ] short-cycle recovery queue engine
- [ ] updated mastery transitions
- [ ] weak-word recap UI spec
- [ ] tests for resurfacing timing and duplicate suppression

### Exit criteria
- wrong answers measurably increase future recall probability;
- repeated mistakes return fast enough to matter but not so fast that the run becomes annoying;
- review mode and in-run learning no longer feel like disconnected systems.

---

## Workstream C - Question and Card UX 2.0
**Goal:** improve the front-end interaction layer without changing the core identity.

### Tasks
- [ ] Rebuild the prompt-and-tray answer layout for maximum readability on mobile
- [ ] Keep 3 large unified answer-piece tray slots as default
- [ ] Test answer reveal timing:
  - [ ] instant feedback
  - [ ] 250-400 ms lock-state
  - [ ] fast transition into placement state
- [ ] Improve drag interaction so question state is obvious before placement
- [ ] Make correct tray selection visibly activate only the matching draggable piece
- [ ] Add one-handed ergonomics pass for common Telegram screen heights
- [ ] Tune font sizing and spacing for Russian source words and French options
- [ ] Improve support for long phrases and article+noun tasks
- [ ] Add stronger visual distinction between:
  - [ ] correct answer
  - [ ] wrong answer
  - [ ] locked move
  - [ ] unlocked move
- [ ] Keep current color direction stable unless usability data says otherwise

### Deliverables
- [ ] gameplay HUD v2 spec
- [ ] prompt card + answer-piece tray component v2
- [ ] motion timing tokens
- [ ] interaction test checklist

### Exit criteria
- users rarely mis-tap due to layout issues;
- answer state is readable in under a second;
- UI feels improved, not reinvented for no reason.

---

## Workstream D - Progression and Retention 2.0
**Goal:** give players reasons to return beyond raw score chasing.

### Tasks
- [ ] Add daily mission system v1
- [ ] Add weekly challenge system v1
- [ ] Add streak protection / recovery rule
- [ ] Add milestone rewards for:
  - [ ] first perfect run
  - [ ] 3-day streak
  - [ ] 10 mastered words
  - [ ] zero-mistake review set
- [ ] Add clearer level map progress indicators
- [ ] Add lesson mastery gates based on both score and learning quality
- [ ] Add “today you learned” summary card
- [ ] Add post-run recommendation:
  - [ ] continue classic run
  - [ ] do quick review
  - [ ] continue lesson
- [ ] Add return triggers for unfinished lessons / weak clusters

### Deliverables
- [ ] retention loop spec
- [ ] mission engine v1
- [ ] post-run recommendation logic
- [ ] progress widgets for home screen

### Exit criteria
- home screen clearly communicates what to do next;
- return behavior is driven by useful goals, not fake noise;
- progression is visible even on mediocre puzzle runs.

---

## Workstream E - Content Operations 2.0
**Goal:** make content scaling safer before broadening level coverage.

### Tasks
- [ ] Expand and clean A1 launch set
- [ ] Expand and clean A2 launch set
- [ ] Add stronger distractor QA tooling
- [ ] Add duplicate / near-duplicate detector for translations and distractors
- [ ] Add article/gender validation rules for noun cards
- [ ] Add phrase-card QA workflow
- [ ] Add content issue flags from live telemetry
- [ ] Add editor dashboard for high-failure items
- [ ] Add content regression tests tied to published packs
- [ ] Prepare B1 content schema extensions without forcing B1 full launch

### Deliverables
- [ ] content QA dashboard
- [ ] ambiguity report tooling
- [ ] updated import validations
- [ ] approved A1/A2 cleanup pack
- [ ] B1 beta-ready schema

### Exit criteria
- editors can identify broken items without hunting through logs like archaeologists;
- live error clusters map cleanly to content fixes;
- B1 can start as a controlled rollout, not a panic dump.

---

## Workstream F - Content Expansion 2.0
**Goal:** grow content only after A1/A2 quality is stable.

### Tasks
- [ ] Raise total approved A1 coverage
- [ ] Raise total approved A2 coverage
- [ ] Define B1 pilot lesson structure
- [ ] Add new card variants only if they are operationally supportable
- [ ] Prioritize phrase/context tasks for upper-A2 and B1 transition
- [ ] Add topic packs that increase replay variety without fragmenting the product
- [ ] Add event packs or temporary packs only after baseline content stability

### Deliverables
- [ ] A1/A2 expansion release
- [ ] B1 pilot lesson pack
- [ ] level transition rules for B1 beta access

### Exit criteria
- A1/A2 feels complete enough that users are not looping the same tiny pool forever;
- B1 exists as a controlled expansion, not a promise written in smoke.

---

## Workstream G - Analytics and Experimentation 2.0
**Goal:** turn v2.0 into a measurable product rather than a vibes project.

### Tasks
- [ ] Add event coverage for heart-loss patterns
- [ ] Add event coverage for repeat-item resurfacing
- [ ] Track answer latency buckets
- [ ] Track no-move board failures by seed and piece set
- [ ] Track mission completion
- [ ] Track weak-word recovery rate
- [ ] Track run summary CTA selection
- [ ] Track rage-quit indicators:
  - [ ] quit after mistake
  - [ ] quit after consecutive mistake cluster
  - [ ] quit after impossible-feeling board
- [ ] Build experiment config support for:
  - [ ] 3 vs 5 vs 6 hearts
  - [ ] 3 vs 5 resurfacing interval
  - [ ] recap on/off
  - [ ] immediate review prompt on/off

### Deliverables
- [ ] v2 analytics taxonomy
- [ ] experiment config layer
- [ ] retention dashboard v2
- [ ] frustration dashboard

### Exit criteria
- product decisions can be made from data rather than testosterone and intuition;
- every major v2.0 balance hypothesis is instrumented.

---

## Workstream H - Technical Hardening 2.0
**Goal:** make iteration safer and faster as the product grows.

### Tasks
- [ ] Add run-resume safety for Telegram reopen and app backgrounding
- [ ] Improve server-side validation for answer/move sequencing
- [ ] Version gameplay config separately from content config
- [ ] Add migration-safe feature flags
- [ ] Add snapshot tests for board state serialization
- [ ] Add regression tests for recovery queue logic
- [ ] Improve admin audit logs
- [ ] Add release notes discipline for gameplay/content config changes
- [ ] Add internal tools to replay suspicious sessions from logs

### Deliverables
- [ ] config versioning model
- [ ] replay/debug tooling
- [ ] stronger test matrix
- [ ] release checklist v2

### Exit criteria
- balance changes can be rolled out without breaking old runs;
- suspicious sessions can be reconstructed;
- content and gameplay regressions are caught earlier.

---

## Workstream I - Monetization Readiness (Only if retention is earned)
**Goal:** prepare gentle monetization without poisoning the core loop.

### Hard rule
Monetization enters only after retention and content quality are acceptable.
No circus before product-market basics exist.

### Tasks
- [ ] Add revive-with-ad experiment design
- [ ] Add optional extra-heart experiment design
- [ ] Add cosmetic theme system foundation
- [ ] Add premium/no-ads concept spec
- [ ] Design monetization guardrails so learning fairness is not destroyed

### Deliverables
- [ ] monetization experiment brief
- [ ] economy guardrails doc
- [ ] cosmetic architecture note

### Exit criteria
- monetization is additive, not predatory;
- ad logic does not break session rhythm;
- premium concepts do not fragment the learning product.

---

## 7. Proposed v2.0 release phases

## Phase 1 - MVP Audit and Delta Lock
**Goal:** define exactly what changes from MVP to v2.0.

### Tasks
- [ ] Audit live MVP behavior
- [ ] Audit current telemetry gaps
- [ ] Confirm v2.0 KPI targets
- [ ] Confirm 5-heart default as v2 test baseline
- [ ] Confirm short-cycle resurfacing rule
- [ ] Freeze v2.0 non-goals

### Exit criteria
- there is one shared definition of v2.0;
- no one is secretly building a different product in their head.

---

## Phase 2 - Gameplay and Front Polish
**Goal:** improve readability, fairness, and feel.

### Includes
- heart model changes
- feedback timing
- answer card polish
- fail-state polish
- placement preview polish
- summary UX polish

### Exit criteria
- gameplay feels noticeably better without retraining the whole user base.

---

## Phase 3 - Review and Mastery 2.0
**Goal:** connect mistake recovery to actual memory improvement.

### Includes
- recovery queue
- recap UX
- retry mini-flow
- mastery state updates
- review scheduler split

### Exit criteria
- weak-word handling becomes visible and useful.

---

## Phase 4 - Progression and Return Loops
**Goal:** create daily/weekly re-entry reasons.

### Includes
- missions
- streak logic
- lesson progress UI
- next-step recommendations
- home screen v2

### Exit criteria
- return path is explicit and motivating.

---

## Phase 5 - Content Quality and Scale
**Goal:** improve A1/A2 depth and prep B1 safely.

### Includes
- A1/A2 cleanup
- telemetry-driven content QA
- B1 pilot structure
- phrase/context enrichment

### Exit criteria
- content scale grows without quality collapse.

---

## Phase 6 - Experimentation and Hardening
**Goal:** turn v2 into a stable iteration platform.

### Includes
- config versioning
- experiments
- replay tools
- stronger regression coverage
- monetization readiness only if earned

### Exit criteria
- the product can evolve without becoming a bug farm with a French accent.

---

## 8. KPI targets for v2.0

The exact numbers should be finalized from MVP baseline.
But v2.0 should explicitly target movement in these areas:

### Engagement
- [ ] increase runs per active user
- [ ] increase average session depth
- [ ] reduce quit-after-first-error rate

### Learning
- [ ] improve weak-word recovery rate
- [ ] improve second-chance correctness after recent error
- [ ] reduce repeated misses on article+noun tasks

### Retention
- [ ] improve D1 retention
- [ ] improve D7 retention
- [ ] improve lesson return completion

### Product health
- [ ] reduce ambiguity-related content failures
- [ ] reduce “felt unfair” board outcomes
- [ ] reduce unresumable or broken runs

---

## 9. Suggested implementation order for Codex / agents

Do not ask for “version 2” in one giant prompt.
That is just a premium way to buy yourself a debugging festival.

### Recommended order
1. audit current MVP contracts and telemetry
2. implement gameplay config versioning
3. implement 5-heart balancing support
4. implement recovery queue engine and tests
5. rebuild prompt-and-tray answer flow UX
6. add recap / retry mini-flow
7. add mission engine and home screen progress widgets
8. add content QA dashboards and high-failure item tooling
9. prepare B1 beta schema and content gates
10. add experimentation layer and dashboards

### Example Codex tasks
- [ ] Add gameplay config versioning with support for heart-count experiments and resurfacing interval experiments
- [ ] Implement short-cycle mistake recovery queue in `packages/content-core` or equivalent learning domain package with tests
- [ ] Refactor gameplay prompt card and answer-piece tray for mobile Telegram viewport without changing color palette
- [ ] Add end-of-run weak-word recap component and API payload support
- [ ] Build admin dashboard widget for high-failure vocabulary items using existing analytics events
- [ ] Implement run-resume handling for Telegram reopen/background flows

---

## 10. Risks specific to v2.0

### Risk 1 - Overcomplication
**Problem:** v2 adds missions, recap, streaks, retries, and B1 prep all at once, making the app heavier.

**Countermeasure:** release in slices, keep first-run clarity sacred.

### Risk 2 - Hearts change masks weak design
**Problem:** increasing hearts may reduce frustration but hide bad board pacing or bad question quality.

**Countermeasure:** instrument board failure reasons and content failure reasons separately.

### Risk 3 - Repetition becomes annoying
**Problem:** weak words come back so often that users feel harassed by the same mistake.

**Countermeasure:** add duplicate suppression, cooldown rules, and telemetry on resurfacing annoyance.

### Risk 4 - Front polish drifts into clone territory
**Problem:** in trying to improve feel, UI gets too close to commercial puzzle references.

**Countermeasure:** preserve original layout logic, avoid asset mimicry, keep the style guide explicit.

### Risk 5 - B1 arrives too early
**Problem:** team expands content surface before A1/A2 quality is stable.

**Countermeasure:** B1 only as gated beta after A1/A2 error rates are acceptable.

### Risk 6 - Missions become fake chores
**Problem:** retention systems feel manipulative rather than useful.

**Countermeasure:** missions must align with learning progress, not random tapping.

---

## 11. v2.0 release checklist

### Product
- [ ] 5-heart model shipped behind configurable flag
- [ ] recovery queue working
- [ ] recap flow working
- [ ] missions/streak logic understandable
- [ ] home screen communicates next best action

### Content
- [ ] A1 high-failure items reviewed
- [ ] A2 high-failure items reviewed
- [ ] ambiguity tooling active
- [ ] B1 beta pack isolated from main release

### Tech
- [ ] run resume safe
- [ ] config versioning live
- [ ] analytics events complete
- [ ] regression tests updated
- [ ] admin audit trail improved

### Ops
- [ ] balance tuning playbook exists
- [ ] content issue triage exists
- [ ] experiment reporting exists
- [ ] rollback plan exists for gameplay config changes

---

## 12. Final recommendation

The smartest v2.0 is not:
- more features for the sake of looking bigger;
- more levels because the roadmap looks lonely;
- more monetization because ads are easy to imagine.

The smartest v2.0 is:
- a better feeling run;
- a more useful mistake loop;
- clearer visible progress;
- stronger return behavior;
- safer content scaling.

In plain language:
MVP proves the idea.
**v2.0 must prove the habit.**
