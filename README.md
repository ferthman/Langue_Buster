# French Learning Mini App

Telegram Mini App for learning French through a block-puzzle gameplay loop.

This product combines a casual puzzle session with active vocabulary recall: to place a block, the player must answer a language question correctly (Russian -> French, French -> Russian, and later phrase/context tasks). The core idea is simple: **knowledge unlocks action**.

## Product idea

The app is **inspired by the block-puzzle genre**, but it must not copy Block Blast or any other existing game one-to-one. Genre mechanics are fair game. Brand, name, exact UI, audio language, iconography, and feel are not.

### Core loop

1. Player opens the Mini App inside Telegram.
2. Chooses a CEFR level (A1, A2, B1, B2, C1, C2) or passes a short placement test.
3. Receives a puzzle board and 3 available pieces.
4. Before placing a piece, the player answers a language prompt.
5. Correct answer unlocks the move.
6. Wrong answer applies a penalty (heart loss, timer reduction, streak break, etc.).
7. Clearing rows/columns grants score, XP, combo bonuses, and learning rewards.
8. End of run shows score, mistakes, mastery updates, and review queue.

## Why Telegram Mini App

This should be built as a **Telegram Mini App**, not as a classic Telegram Game.

Reasons:
- better product flexibility;
- multiple screens and flows;
- proper onboarding;
- course map and review mode;
- server-side auth and session control;
- strong analytics;
- content CMS;
- future monetization and events.

Telegram Game format is too narrow for a real learning product. It is fine for a score-chasing arcade toy. It is not fine for a scalable language-learning system.

## Mini App runtime note

The frontend reads the backend origin from `VITE_API_BASE_URL`.

For Telegram launches, the backend must be reachable over `https://` from the public internet. A local value such as `http://localhost:4000` works only for local browser development on the same machine and will fail inside Telegram on a phone or remote client.

## Target learning model

The level structure should follow:
- CEFR descriptors;
- French-specific reference descriptions;
- DELF/DALF expectations;
- curated pedagogical and lexical sources.

Important: CEFR does **not** define one official universal vocabulary list per level. The app should treat level content as a **product design decision informed by CEFR-aligned sources**, not as fake “official word counts”.

## Recommended MVP scope

Start narrow. Very narrow.

### MVP must include
- Russian UI
- French learning content
- 2 levels at launch: A1 and A2
- 1 main game mode: Classic Run
- 3 card types:
  - single word
  - phrase
  - article + noun
- placement test
- mastery tracking
- review queue
- manual QA-backed CMS
- telemetry from day 1

### MVP must NOT include
- PvP
- clans
- deep social features
- hard currency
- overengineered monetization
- 6 fancy game modes
- full C1/C2 launch
- AI-generated content with no editorial control

If you try to launch all six CEFR levels at once, the content pipeline will eat your soul.

## Recommended gameplay design

### Board
- 8x8 board for MVP
- 3 pieces available at all times
- new set appears after all 3 are used

### Answer gating
- A1-A2: question before each move
- B1-B2: mostly per move, with occasional special mechanics
- C1-C2: more nuance, context, phrase usage, register and precision

### Penalties
Recommended MVP model:
- 3 hearts per run
- wrong answer costs 1 heart
- optional timer/streak penalties later

### Rewards
- score for cleared lines
- combo multiplier
- XP
- mastery progress
- daily mission progress
- recovery bonus for weak words

## CEFR level design

Planned levels:
- A1
- A2
- B1
- B2
- C1
- C2

Recommended launch order:
1. A1
2. A2
3. B1
4. B2
5. C1
6. C2

Each level should have:
- thematic packs
- lesson order
- review layer
- progression gates based on mastery, not just score

## Vocabulary content pipeline

Do not build the course from one random CSV. That is how projects become cursed.

### Source-of-truth model
Use a layered pipeline:
1. CEFR / RLD for level expectations
2. DELF/DALF for exam-aligned difficulty signals
3. TV5MONDE-like thematic pedagogical material
4. Lexique-style lexical frequency data
5. internal editorial review as final authority

### Content pipeline
1. source collection
2. normalization
3. CEFR mapping
4. translation validation
5. distractor generation
6. lesson assignment
7. QA review
8. publishing

### Required fields for a vocabulary item
- `id`
- `lemma`
- `surface_form`
- `pos`
- `gender`
- `article`
- `translation_ru`
- `translation_en` (optional but useful internally)
- `cefr_level`
- `topic`
- `subtopic`
- `register`
- `example_sentence_fr`
- `example_sentence_ru`
- `distractors`
- `status`
- `source`
- `frequency_score`
- `editor_notes`

## Distractor rules

### A1-A2
Distractors should be plausible but not evil.
Example:
- яблоко -> pomme
- wrong choices: orange, banane, poire

### B1-B2
Distractors should often stay in the same semantic field and part of speech.

### C1-C2
Distractors should test nuance:
- register
- precision
- context
- near-synonym traps

### Global rules
- same part of speech where possible
- similar difficulty band
- same thematic domain when appropriate
- never include multiple truly correct answers
- control gender and article for nouns
- separate verb tasks by grammatical objective

## UX / UI principles

Do not visually clone Block Blast.

### Visual direction
- clean
- warm
- modern
- readable
- slightly playful
- “French feel” through typography and palette, not through baguette cringe

### Round screen layout
1. header: score, hearts, streak
2. question card
3. board
4. tray with 3 pieces

### Interaction rules
- large tap targets
- fast transitions
- short animations (roughly 120-220 ms)
- haptic feedback for correct answer, error, combo
- Telegram theme support
- dark mode support
- zero visual clutter

## Recommended technical architecture

### Stack
- **Monorepo**
- **TypeScript end-to-end**
- **Frontend Mini App:** Next.js or React + Telegram WebApp SDK
- **Game rendering layer:** Phaser or Pixi for the actual board/piece experience
- **Backend API:** NestJS
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Cache / queues:** Redis
- **Admin / CMS:** Next.js admin app
- **Storage:** S3-compatible bucket
- **Analytics:** PostHog, Amplitude, or self-hosted event pipeline
- **Infra:** Docker + CI/CD

### Why this stack
Because you want one consistent developer language across:
- DTOs
- validators
- domain models
- Prisma schema
- API contracts
- admin CMS
- frontend types
- automated tests

That saves time and makes Codex much less likely to hallucinate mismatched contracts.

## High-level system architecture

```text
Telegram Client
    ->
Mini App Frontend
    ->
API Gateway / Backend
    ->
PostgreSQL / Redis / Storage
    ->
Admin CMS / Content Pipeline / Analytics
```

## Authentication and security

Critical rule:
**Never trust `initDataUnsafe` as a source of truth.**

### Auth flow
1. Frontend receives Telegram `initData`.
2. Frontend sends it to backend.
3. Backend validates Telegram signature server-side.
4. Backend creates or finds internal user.
5. Backend returns internal session / JWT / secure cookie.
6. All subsequent app requests use internal auth.

### Security rules
- validate Telegram launch data on server
- never trust final score from client
- use server-side recalculation for key game outcomes
- rate-limit critical endpoints
- store or sign game seeds
- detect impossible timing / anomaly patterns

## Core domains

Suggested core entities:
- `User`
- `UserSettings`
- `Level`
- `Lesson`
- `Topic`
- `VocabItem`
- `DistractorSet`
- `RunSession`
- `MoveEvent`
- `AnswerEvent`
- `UserMastery`
- `ReviewQueueItem`
- `DailyMission`
- `RewardLedger`
- `CosmeticItem`
- `AnalyticsEvent`
- `ContentAuditLog`

## Example API surface

### Auth
- `POST /auth/telegram`
- `POST /auth/refresh`

### Profile
- `GET /me`
- `PATCH /me/settings`

### Content
- `GET /levels`
- `GET /levels/:levelId/lessons`
- `GET /lessons/:lessonId`
- `GET /review/queue`

### Game
- `POST /runs/start`
- `POST /runs/:runId/answer`
- `POST /runs/:runId/move`
- `POST /runs/:runId/finish`

### CMS
- `GET /admin/vocab-items`
- `POST /admin/vocab-items`
- `PATCH /admin/vocab-items/:id`
- `POST /admin/import`
- `POST /admin/publish`

## Progression and spaced repetition

Progress must not depend only on puzzle skill.

You need two separate tracks:
- game skill
- language mastery

### Recommended mastery states
- `new`
- `learning`
- `weak`
- `stable`
- `mastered`

### Recommended update inputs
- correctness
- response latency
- number of past errors
- interval since last exposure
- review performance trend

This is enough for MVP. Do not invent NASA-grade memory science on day one.

## CMS requirements

A real CMS is mandatory.

### Must-have features
- draft / review / approved / archived statuses
- vocabulary preview in question card format
- bulk import
- bulk edit
- change history
- QA flags
- lesson assignment
- CEFR and topic filters

Without CMS, content operations will become a spreadsheet cemetery.

## Analytics from day 1

Track at least:
- acquisition source
- onboarding completion
- placement test completion
- first run start
- first run finish
- D1 / D7 retention
- answer accuracy by item
- weak-word clusters
- run length
- hearts lost
- failure reason
- review usage
- lesson completion
- streak recovery behavior

## Anti-cheat

Never let client score be the source of truth.

### Minimum anti-cheat rules
- server-signed or server-generated seeds
- server validation of move legality
- server validation of answer correctness
- server-side score recomputation
- rate limits
- anomaly detection for:
  - impossible speed
  - impossible accuracy
  - repeated suspicious patterns

## Monorepo structure

```text
apps/
  miniapp/         # Telegram Mini App frontend
  admin/           # Content CMS and dashboards
  api/             # NestJS backend

packages/
  shared/          # shared types, DTOs, constants, schemas
  game-engine/     # board logic, piece generation, scoring, validation
  content-core/    # vocab schemas and content rules
  ui/              # optional shared UI primitives
  config/          # shared tsconfig, eslint, tooling
```

## Suggested development order

1. monorepo bootstrap
2. Telegram auth
3. user/session module
4. board engine
5. run session logic
6. answer validation
7. vocab/content module
8. mastery and review queue
9. CMS CRUD
10. analytics events
11. polish, QA, tuning

## How to work with Codex

Do **not** ask Codex:
> “build the entire app”

That is how you get a giant soup of half-correct files.

Ask module by module.

Examples:
- build a Telegram auth module with server-side initData validation
- implement an 8x8 board engine with pure functions and unit tests
- define Prisma schema for vocab items, lessons, user mastery, and run sessions
- create API contracts for starting a run, submitting an answer, and placing a piece
- implement distractor validation rules with zod schemas and tests

## Practical launch recommendation

Start with:
- Russian UI
- A1-A2 only
- 300-500 polished items
- one core gameplay mode
- strong telemetry
- manual content QA

Then look at:
- D1 retention
- D7 retention
- completion rate
- weak-word patterns
- session length
- replay behavior

Only after that expand the content surface.

## References used for the original blueprint

- Telegram Mini Apps / Web Apps documentation
- Telegram Bot API Games documentation
- CEFR overview and descriptors
- CEFR Reference Level Descriptions
- DELF / DALF official expectations
- French lexical frequency resources
- TV5MONDE level-based pedagogical content

## Status

This repository is currently at the **planning / architecture stage**.

No production implementation should begin until:
- repo structure is approved;
- domain model is finalized;
- MVP scope is frozen;
- content schema is approved;
- first 100-200 vocabulary items are manually reviewed.

## License / legal note

This project must avoid copying:
- Block Blast branding
- exact UI
- sound design
- asset style
- trademarked naming

Use genre inspiration, not asset theft. We are building a product, not a lawsuit starter pack.
# Langue_Buster
