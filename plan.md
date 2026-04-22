# Implementation Plan

Detailed execution plan for the Telegram Mini App that teaches French through a block-puzzle gameplay loop.

This file is meant to be used as the operational source for:
- sprint planning;
- Codex task breakdown;
- architecture sequencing;
- MVP scope control;
- product and content alignment.

---

## 0. Product goal

Build a Telegram Mini App where puzzle actions are gated by French language questions, so that:
- gameplay drives retention;
- vocabulary recall drives progression;
- mastery is measurable;
- content can scale safely through a CMS.

Success means:
- the app is fun enough to replay;
- the learning is strong enough to improve recall;
- the tech stack is maintainable;
- content operations do not collapse into spreadsheet chaos.

---

## 1. Non-negotiable product decisions

- Build as **Telegram Mini App**, not classic Telegram Game.
- Use **TypeScript end-to-end**.
- Launch with **A1 and A2 only**.
- Support **Russian UI + French content** in MVP.
- Start with **Classic Run** as the only mandatory game mode.
- Use **server-side validation** for Telegram auth and critical game state.
- Use **manual editorial QA** for all launch vocabulary.
- Do not clone Block Blast visuals, assets, or brand identity.

---

## 2. MVP definition

### In scope
- Telegram auth
- onboarding
- placement test
- home screen
- level selection
- lesson packs
- classic run
- end-of-run summary
- mastery updates
- review queue
- stats screen
- admin CMS
- analytics events
- anti-cheat baseline

### Out of scope
- PvP
- guilds / teams
- hard currency
- social graph
- real-time multiplayer
- advanced cosmetics shop
- AI-only content generation
- six levels at launch
- speech recognition
- audio pronunciation system
- deep narrative events

---

## 3. Delivery phases

## Phase 1 - Product specification freeze
**Goal:** lock the MVP so development does not drift.

### Tasks
- [ ] Confirm gameplay loop
- [ ] Confirm board size: 8x8
- [ ] Confirm penalty model: 3 hearts
- [ ] Confirm first card types:
  - [ ] word translation
  - [ ] phrase translation
  - [ ] article + noun
- [ ] Confirm supported levels at launch: A1, A2
- [ ] Confirm primary UI language: Russian
- [ ] Confirm launch metrics
- [ ] Confirm no-clone visual direction
- [ ] Freeze initial domain glossary

### Deliverables
- [ ] approved gameplay rules
- [ ] approved MVP scope
- [ ] approved content schema v1
- [ ] approved screen list
- [ ] approved backend module list

### Exit criteria
- Everyone can describe the MVP in the same way.
- There is no ambiguity about what is intentionally excluded.

---

## Phase 2 - Monorepo and tooling bootstrap
**Goal:** create a clean technical foundation.

### Tasks
- [ ] Create monorepo
- [ ] Configure package manager workspace
- [ ] Configure TypeScript project references
- [ ] Configure ESLint + Prettier
- [ ] Configure shared tsconfig
- [ ] Add Husky / lint-staged if needed
- [ ] Configure testing stack
- [ ] Configure environment variable strategy
- [ ] Add Docker setup
- [ ] Add CI workflow

### Recommended repo layout
```text
apps/
  miniapp/
  admin/
  api/

packages/
  shared/
  game-engine/
  content-core/
  ui/
  config/
```

### Deliverables
- [ ] working monorepo
- [ ] clean install script
- [ ] clean dev scripts
- [ ] CI checks for lint + test + build

### Exit criteria
- New developer can clone repo and run local environment without black magic.

---

## Phase 3 - Telegram auth and session layer
**Goal:** secure entry into the app.

### Tasks
- [ ] Implement Telegram initData parser
- [ ] Implement server-side initData signature validation
- [ ] Implement internal user creation / lookup
- [ ] Implement session issuance
- [ ] Implement refresh flow
- [ ] Store Telegram metadata:
  - [ ] telegram_user_id
  - [ ] username
  - [ ] first_name
  - [ ] language_code
  - [ ] premium flag
- [ ] Add auth middleware / guards
- [ ] Add auth tests

### API
- [ ] `POST /auth/telegram`
- [ ] `POST /auth/refresh`

### Deliverables
- [ ] production-safe auth flow
- [ ] unit tests
- [ ] integration tests

### Exit criteria
- User can open Mini App from Telegram and receive a valid internal session.
- Backend rejects tampered init data.

---

## Phase 4 - Core game engine
**Goal:** implement puzzle logic as deterministic pure domain logic.

### Tasks
- [ ] Define board model
- [ ] Define piece model
- [ ] Define piece generation strategy
- [ ] Implement placement validation
- [ ] Implement line clear logic
- [ ] Implement combo logic
- [ ] Implement run-over condition
- [ ] Implement score calculation
- [ ] Implement serialization for run state
- [ ] Add full unit tests

### Engine rules
- board size: 8x8
- active tray size: 3 pieces
- deterministic validation
- server-compatible logic
- pure functions where possible

### Deliverables
- [ ] reusable `game-engine` package
- [ ] test coverage for all core rules
- [ ] seed-based reproducibility

### Exit criteria
- Same inputs always produce same outputs.
- Game logic is not dependent on UI framework.

---

## Phase 5 - Content domain and vocabulary schema
**Goal:** define how learning content is represented.

### Tasks
- [ ] Design `VocabItem` schema
- [ ] Design `Lesson` schema
- [ ] Design `Topic` schema
- [ ] Design `DistractorSet` schema
- [ ] Design `Level` schema
- [ ] Design content statuses:
  - [ ] draft
  - [ ] on_review
  - [ ] approved
  - [ ] archived
- [ ] Define content validation rules
- [ ] Implement shared zod schemas
- [ ] Define editorial import format

### Required content fields
- [ ] lemma
- [ ] surface_form
- [ ] part of speech
- [ ] article / gender where relevant
- [ ] Russian translation
- [ ] CEFR level
- [ ] topic
- [ ] example sentence
- [ ] distractors
- [ ] source
- [ ] status
- [ ] frequency score
- [ ] editorial notes

### Deliverables
- [ ] content schema v1
- [ ] migration plan
- [ ] import template

### Exit criteria
- Every learning item can be validated consistently before publication.

---

## Phase 6 - Answer evaluation layer
**Goal:** connect language questions to the game loop.

### Tasks
- [ ] Define card types
- [ ] Implement question generation per card type
- [ ] Implement distractor selection rules
- [ ] Implement correctness evaluation
- [ ] Define penalties for wrong answers
- [ ] Define move unlock behavior
- [ ] Define answer telemetry
- [ ] Add tests for ambiguous answer prevention

### MVP card types
- [ ] single word translation
- [ ] phrase translation
- [ ] article + noun selection

### Deliverables
- [ ] answer evaluator
- [ ] distractor validator
- [ ] card generation service

### Exit criteria
- Each question has exactly one correct answer.
- A correct answer reliably unlocks the move.

---

## Phase 7 - Run session backend
**Goal:** support full gameplay sessions.

### Tasks
- [ ] Define `RunSession` schema
- [ ] Define `MoveEvent` schema
- [ ] Define `AnswerEvent` schema
- [ ] Implement run start
- [ ] Implement answer submit
- [ ] Implement move submit
- [ ] Implement end-of-run summary
- [ ] Implement server-side score recomputation
- [ ] Implement seed strategy
- [ ] Persist run result summary

### API
- [ ] `POST /runs/start`
- [ ] `POST /runs/:runId/answer`
- [ ] `POST /runs/:runId/move`
- [ ] `POST /runs/:runId/finish`

### Deliverables
- [ ] server-backed run system
- [ ] anti-tamper validation
- [ ] summary payload for frontend

### Exit criteria
- Backend can validate each run step.
- Client is not the source of truth for score.

---

## Phase 8 - Mastery, review, and progression
**Goal:** separate learning progress from raw game score.

### Tasks
- [ ] Define `UserMastery` schema
- [ ] Define `ReviewQueueItem` schema
- [ ] Implement mastery states:
  - [ ] new
  - [ ] learning
  - [ ] weak
  - [ ] stable
  - [ ] mastered
- [ ] Define mastery update rules
- [ ] Implement review queue scheduler
- [ ] Implement weak-word resurfacing
- [ ] Implement run-end mastery update
- [ ] Implement review mode feed

### Deliverables
- [ ] mastery engine v1
- [ ] review queue generator
- [ ] review API

### Exit criteria
- Weak words come back more often.
- Strong words gradually move into longer intervals.

---

## Phase 9 - Mini App frontend
**Goal:** build a smooth Telegram-facing app.

### Screens
- [ ] splash
- [ ] onboarding
- [ ] placement test
- [ ] home
- [ ] level map
- [ ] classic run
- [ ] review mode
- [ ] profile / stats
- [ ] error / empty states

### Tasks
- [ ] Integrate Telegram WebApp SDK
- [ ] Read theme params
- [ ] Support dark mode
- [ ] Implement responsive layout
- [ ] Build question card UI
- [ ] Build board UI
- [ ] Build tray UI
- [ ] Build run summary UI
- [ ] Implement haptic feedback
- [ ] Implement animation layer
- [ ] Add loading / retry states

### UX constraints
- large tap targets
- zero clutter
- fast transitions
- readable question card
- no asset cloning from existing games

### Deliverables
- [ ] usable Mini App frontend
- [ ] Telegram-compatible layout
- [ ] interaction polish pass

### Exit criteria
- A new user can complete first onboarding and first run without confusion.

---

## Phase 10 - Admin CMS
**Goal:** make content operations survivable.

### Tasks
- [ ] Build vocab item list
- [ ] Build vocab item detail editor
- [ ] Build lesson editor
- [ ] Build topic editor
- [ ] Build bulk import
- [ ] Build bulk edit
- [ ] Build item preview
- [ ] Build QA flags
- [ ] Build publish / archive workflow
- [ ] Build change history log

### CMS requirements
- preview each item as in actual game card
- filter by level / topic / status
- mark problematic items
- avoid raw spreadsheet-only operations

### Deliverables
- [ ] content CMS v1
- [ ] import flow
- [ ] review workflow

### Exit criteria
- Editor can create, review, preview, approve, and publish content without touching database directly.

---

## Phase 11 - Content population
**Goal:** prepare real launch content.

### Tasks
- [ ] Build A1 source list
- [ ] Build A2 source list
- [ ] Normalize entries
- [ ] Map to lessons and topics
- [ ] Add examples
- [ ] Add distractors
- [ ] Review article/gender correctness
- [ ] Run ambiguity QA
- [ ] Publish first launch set

### Content target
- [ ] 300 items minimum
- [ ] 500 items preferred
- [ ] all manually reviewed

### Deliverables
- [ ] launch content pack
- [ ] QA report
- [ ] blocked/problematic item list

### Exit criteria
- Launch content is clean enough that users do not keep hitting broken questions.

---

## Phase 12 - Analytics and observability
**Goal:** measure what matters from day one.

### Tasks
- [ ] Define event taxonomy
- [ ] Instrument onboarding events
- [ ] Instrument gameplay events
- [ ] Instrument answer correctness events
- [ ] Instrument run finish events
- [ ] Instrument review mode usage
- [ ] Instrument retention markers
- [ ] Add backend logs
- [ ] Add error tracking
- [ ] Build baseline dashboards

### Must-track metrics
- [ ] onboarding completion
- [ ] first run start
- [ ] first run finish
- [ ] answer accuracy
- [ ] D1 retention
- [ ] D7 retention
- [ ] run length
- [ ] weak-word cluster frequency
- [ ] lesson completion
- [ ] review adoption

### Deliverables
- [ ] analytics schema
- [ ] dashboards
- [ ] error monitoring

### Exit criteria
- Team can answer “where users drop?” and “which content is failing?” without guessing.

---

## Phase 13 - Anti-cheat baseline
**Goal:** stop obvious abuse before leaderboards become a circus.

### Tasks
- [ ] Never trust client score
- [ ] Sign or store game seeds
- [ ] Recompute move legality server-side
- [ ] Recompute score server-side
- [ ] Rate-limit key endpoints
- [ ] Detect impossible timings
- [ ] Detect suspicious perfection patterns
- [ ] Log anomalies for moderation review

### Deliverables
- [ ] anti-cheat guardrails
- [ ] anomaly logs
- [ ] server validation checks

### Exit criteria
- Basic client tampering no longer gives free leaderboard dominance.

---

## Phase 14 - QA and balancing
**Goal:** make the experience playable, fair, and understandable.

### QA tracks
#### Functional QA
- [ ] auth
- [ ] run flow
- [ ] review flow
- [ ] CMS publishing
- [ ] session restore
- [ ] Telegram reopen behavior

#### Content QA
- [ ] translation correctness
- [ ] distractor quality
- [ ] level appropriateness
- [ ] article/gender accuracy
- [ ] ambiguity checks

#### Game balance QA
- [ ] board readability
- [ ] piece pacing
- [ ] penalty severity
- [ ] combo reward feel
- [ ] average run duration

#### UX QA
- [ ] onboarding clarity
- [ ] tap accuracy
- [ ] animation speed
- [ ] error messaging
- [ ] dark mode polish

### Deliverables
- [ ] QA checklist
- [ ] balance notes
- [ ] bug triage board

### Exit criteria
- First-time user experience is clean.
- Broken or unfair content is below acceptable threshold.

---

## Phase 15 - Soft launch
**Goal:** release small, learn fast, avoid public embarrassment.

### Tasks
- [ ] Select small test cohort
- [ ] Launch with A1-A2 only
- [ ] Monitor live analytics
- [ ] Review weak items daily
- [ ] Patch obvious content issues quickly
- [ ] Tune penalty curve
- [ ] Tune mastery thresholds
- [ ] Tune review resurfacing frequency

### Success metrics for soft launch
- [ ] acceptable first session completion rate
- [ ] acceptable D1 retention
- [ ] no catastrophic content failure clusters
- [ ] positive replay signal
- [ ] users understand the loop without manual explanation

### Deliverables
- [ ] launch report
- [ ] retention report
- [ ] content issue report
- [ ] tuning backlog

### Exit criteria
- Product shows real replay potential.
- The app feels like a game with learning, not homework in disguise.

---

## 4. Suggested sprint order

### Sprint 1
- spec freeze
- monorepo bootstrap
- Telegram auth
- DB setup
- shared types

### Sprint 2
- board engine
- run session backend
- answer evaluator
- basic frontend shell

### Sprint 3
- classic run UI
- mastery logic
- run summary
- profile basics

### Sprint 4
- admin CMS CRUD
- bulk import
- preview tools
- content QA tooling

### Sprint 5
- analytics
- anti-cheat baseline
- review mode
- balancing pass

### Sprint 6
- onboarding polish
- placement test
- bug fixing
- soft launch prep

---

## 5. Codex execution strategy

### Rules for using Codex
- never ask for the whole platform in one prompt;
- isolate one module per task;
- require tests for domain-critical logic;
- keep DTOs and contracts explicit;
- ask for pure functions in game logic;
- validate all Prisma and API output against shared schemas.

### Good Codex task examples
- [ ] Create a pnpm monorepo with apps/api, apps/miniapp, apps/admin, and packages/shared
- [ ] Implement Telegram initData validation in NestJS with unit tests
- [ ] Build a pure TypeScript 8x8 board engine with piece placement validation and line clear logic
- [ ] Define Prisma models for User, RunSession, VocabItem, Lesson, and UserMastery
- [ ] Create zod schemas for VocabItem and DistractorSet with validation rules
- [ ] Build REST endpoints for run start, answer submit, move submit, and finish summary
- [ ] Build a React question card component optimized for Telegram mobile viewport

### Bad Codex prompt example
- [ ] “Build the whole French app with all features”

That prompt is basically asking the model to freestyle its own future mistakes.

---

## 6. Risks and countermeasures

### Risk 1 - Content quality collapse
**Problem:** bad translations, ambiguous distractors, broken level mapping  
**Countermeasure:** manual editorial QA + preview tools + launch with small content set

### Risk 2 - Puzzle is fun, learning is weak
**Problem:** players optimize score but do not retain vocabulary  
**Countermeasure:** mastery tracking, review queue, weak-word resurfacing

### Risk 3 - Learning is strong, gameplay is boring
**Problem:** app feels like flashcards wearing a fake moustache  
**Countermeasure:** polish combo loop, tactile feedback, quick runs, satisfying board interactions

### Risk 4 - Telegram auth/security mistakes
**Problem:** trusting unsafe client data  
**Countermeasure:** strict server-side validation and short-lived internal sessions

### Risk 5 - Codex-generated architecture drift
**Problem:** inconsistent contracts and messy repo structure  
**Countermeasure:** freeze architecture, centralize schemas, break tasks into modules

### Risk 6 - Launching too many levels
**Problem:** content debt explodes  
**Countermeasure:** A1-A2 only at first launch

---

## 7. Launch readiness checklist

### Product
- [ ] onboarding is clear
- [ ] first run feels good
- [ ] users understand why answers unlock moves

### Content
- [ ] 300-500 reviewed items ready
- [ ] no major ambiguity bugs
- [ ] A1 and A2 lessons complete

### Tech
- [ ] Telegram auth secure
- [ ] backend stable
- [ ] analytics live
- [ ] error monitoring live
- [ ] anti-cheat baseline live

### Ops
- [ ] CMS usable
- [ ] rollback plan exists
- [ ] issue triage process exists
- [ ] soft launch support workflow exists

---

## 8. First post-launch decisions

After the first real cohort, decide based on data:

- If replay is strong but errors are random -> improve content quality.
- If users like review more than classic run -> strengthen review mode and short-session loops.
- If puzzle engagement is strong -> deepen puzzle systems.
- If users struggle to understand progression -> simplify progression UI.
- If A1 retention is good -> expand A2 content.
- If A2 performs well -> start B1 planning.

Do not scale because the roadmap says so. Scale because the data earns it.

---

## 9. Final recommendation

Ship:
- Russian UI
- A1-A2
- 1 core mode
- 300-500 polished items
- strong telemetry
- real editorial QA

Then learn from reality.

The biggest trap in this project is building either:
1. a boring course painted as a game, or
2. a shiny game with learning stapled onto it.

The only version worth shipping is the middle path:
**short, clean, addictive gameplay where actual knowledge changes what the player can do.**
