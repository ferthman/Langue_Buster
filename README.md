# French Learning Mini App

Telegram Mini App for learning French through a block-puzzle gameplay loop.

This product combines a casual puzzle session with active vocabulary recall: to place a block, the player must answer a language question correctly. The main idea stays simple and strong:

**knowledge unlocks action**.

---

## Product status

The repository should be treated as:
- **MVP foundation defined**;
- **v2.0 product direction approved**;
- **implementation should follow the current docs, not stale assumptions from older planning notes**.

This is not a rewrite project.
The goal is to ship a polished Telegram Mini App that starts narrow, proves retention, and then expands in a controlled way.

---

## Core product truth

This product is:
- a **Telegram Mini App**, not a classic Telegram Game;
- a **language-learning game**, not just a flashcard deck with decorations;
- a **block-puzzle inspired product**, not a Block Blast clone;
- a **content-led learning system**, not an AI-content roulette machine.

The app may take inspiration from the genre loop of board + pieces + line clearing, but it must not copy brand identity, exact UI, sound language, asset style, naming, or feel from existing commercial games.

---

## Game concept

The player sees:
- an **8x8 board**;
- **3 available blocks**;
- a **question card** with 4 answer options;
- run HUD with score, hearts, streak, and other light feedback.

To place a block, the player must answer correctly.
Correct answer -> move becomes available.
Wrong answer -> player is penalized and the item is marked for faster repetition.

This creates a loop where puzzle progress depends on language recall.

---

## Canonical game loop

1. Player opens the Mini App inside Telegram.
2. Player chooses a level or enters through the current progression flow.
3. Run starts with an 8x8 board and 3 available blocks.
4. Player selects a block.
5. A question card appears with a prompt and 4 answer options.
6. If the answer is correct, the move unlocks.
7. The player places the block on the board.
8. Board resolves line clears, combo logic, score, and progression feedback.
9. If the answer is wrong, the player loses a heart and the item goes into short-cycle recovery.
10. When all 3 blocks are used, a new set of 3 blocks is generated.
11. Run continues until the player has no hearts left or no legal placements remain.
12. End-of-run summary shows score, mistakes, weak words, mastery movement, and follow-up review signals.

---

## Core gameplay rules

### Board and pieces
- board size: **8x8**;
- tray size: **3 pieces**;
- new set appears after all 3 pieces are used;
- placement must always be validated by deterministic game logic.

### Answer gating
- every move in the main run is gated by a language prompt;
- default answer format is **4 options with exactly 1 correct answer**;
- card types evolve by level, but MVP and early v2 stay focused and readable.

### Failure conditions
A run ends when:
- hearts reach zero; or
- none of the current pieces can be legally placed.

### Scoring and rewards
Reward sources can include:
- valid block placement;
- row or column clears;
- combo chains;
- correct-answer streaks;
- recovery of previously weak words;
- lesson or mission progress.

---

## Hearts model

There are two different states in the documentation history, so here is the actual rule:

### MVP baseline
- MVP planning originally assumed **3 hearts** to keep the loop simple and harsh enough for testing.

### Current direction for v2.0
- the working post-MVP default is **5 hearts**;
- this better fits a hybrid product where the user is both solving a puzzle and learning vocabulary;
- balancing should still allow experiments with **4 / 5 / 6 hearts**.

So if the team asks, “what is the current preferred default?”, the answer is:

**5 hearts for v2.0, with balancing instrumentation.**

---

## Repetition and learning loop

Wrong answers must not be pure punishment.
They must feed learning recovery.

### Required repetition rule
- wrong answer -> item enters a **short-cycle recovery queue**;
- item should reappear after roughly **3-5 new prompts**;
- current preferred v2 default: **around 5 new prompts**;
- long-term review scheduling remains separate from in-run short-cycle resurfacing.

### Learning states
Recommended mastery states:
- `new`
- `learning`
- `weak`
- `recent_error`
- `stable`
- `mastered`

The product must distinguish between:
- one random miss;
- repeated misses;
- article/gender confusion;
- impulse errors;
- genuinely weak vocabulary.

---

## Card types

### MVP card types
- single word translation;
- short phrase translation;
- article + noun selection.

### Later card expansion
After the loop is proven, the product may expand into:
- French -> Russian tasks;
- context-based phrase choice;
- sentence completion;
- nuance/register tasks;
- grammar-linked variations.

But early development must keep the question model tight, fast, and unambiguous.

---

## Difficulty model

### Launch levels
- A1
- A2

### Planned long-term levels
- A1
- A2
- B1
- B2
- C1
- C2

### Launch order
1. A1
2. A2
3. B1
4. B2
5. C1
6. C2

Do not pretend CEFR gives one official universal word list per level.
Level content is a **product decision informed by CEFR-aligned sources**, editorial review, and practical learning design.

---

## Content pipeline

Do not build the course from one random CSV.
That is how good ideas become cursed infrastructure.

### Source-of-truth hierarchy
1. CEFR and language-specific reference descriptions;
2. DELF/DALF-aligned expectations;
3. thematic pedagogical sources;
4. frequency-informed lexical resources;
5. internal editorial review as final authority.

### Content pipeline
1. source collection;
2. normalization;
3. CEFR mapping;
4. translation validation;
5. distractor generation;
6. lesson assignment;
7. QA review;
8. publishing.

### Required fields for a vocab item
- `id`
- `lemma`
- `surface_form`
- `pos`
- `gender`
- `article`
- `translation_ru`
- `translation_en` optional
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

---

## Distractor rules

Distractors must be plausible, but they must not be disgusting little trick bombs.

### Global rules
- same part of speech where possible;
- similar difficulty band;
- same domain when useful;
- no multiple truly correct answers;
- nouns must respect article and gender logic;
- verb prompts must match the grammatical objective.

### Level feel
- **A1-A2:** plausible, clear, not cruel;
- **B1-B2:** closer semantic field and tighter contrast;
- **C1-C2:** nuance, register, precision, and near-synonym control.

---

## UX and UI direction

Do not clone Block Blast visually.
Build a cleaner, warmer, more readable identity.

### Desired feel
- clean;
- warm;
- modern;
- readable;
- lightly playful;
- French in vibe, not in cringe stereotypes.

### Canonical run screen layout
1. header with score, hearts, streak;
2. question card;
3. board;
4. tray with 3 pieces.

### Interaction rules
- large tap targets;
- fast state transitions;
- short animations, roughly **120-220 ms**;
- strong readable state changes for correct, wrong, combo, locked, unlocked;
- dark mode support;
- Telegram theme support;
- minimal clutter.

### Feedback rules
- correct answer: positive visual confirmation, optional haptic, fast unlock state;
- wrong answer: visible error state, heart-loss feedback, clear explanation of the loss;
- combo: stronger celebratory feedback, but short and punchy;
- game over: exact fail reason must be obvious.

### Frontend ergonomics
The UI must work well on Telegram mobile viewport.
That means:
- one-handed usability where possible;
- clear typography for Russian prompts and French options;
- long phrases must wrap cleanly;
- no tiny buttons that make the player want to throw the phone into orbit.

---

## Technical architecture

### Recommended stack
- **Monorepo**
- **TypeScript end-to-end**
- **Frontend Mini App:** React + Telegram WebApp SDK
- **Game rendering layer:** Pixi or equivalent lightweight game rendering approach
- **Backend API:** NestJS
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Cache / queues:** Redis
- **Admin / CMS:** React or Next.js admin app
- **Analytics:** typed event pipeline
- **Infra:** Docker + CI/CD

### Monorepo shape
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
  analytics/
  config/
```

### High-level flow
```text
Telegram Client
    ->
Mini App Frontend
    ->
Backend API
    ->
PostgreSQL / Redis / Storage
    ->
Admin CMS / Content Pipeline / Analytics
```

---

## Security and anti-cheat

Critical rules:
- never trust `initDataUnsafe` as a source of truth;
- validate Telegram launch data server-side;
- never trust client score as final truth;
- recompute critical run outcomes on the server;
- validate move legality server-side;
- sign or store seeds;
- rate-limit critical endpoints;
- log suspicious timing and impossible patterns.

---

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
- `AnalyticsEvent`
- `ContentAuditLog`

---

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

---

## Current operating roadmap

### MVP
- Russian UI;
- A1 and A2 only;
- Classic Run;
- placement test;
- mastery tracking;
- review queue;
- editorial CMS;
- analytics and anti-cheat baseline.

### v2.0 after MVP
- 5-heart balancing pass;
- explicit short-cycle repetition in-run;
- stronger question card UX;
- daily and weekly mission layer;
- richer mastery feedback;
- content cleanup and scaling;
- B1 preparation without exploding scope;
- better analytics for retention and frustration points.

---

## Status discipline

No production implementation should drift outside approved scope just because somebody got excited at 2 a.m.

Before major implementation, the team should align on:
- current gameplay defaults;
- content schema;
- run contract shape;
- MVP vs v2 boundaries;
- frontend interaction states;
- analytics event taxonomy.

---

## Final product rule

The biggest trap is building either:
1. homework disguised as a game; or
2. a shiny puzzle where learning is stapled on afterward.

The version worth shipping is the middle path:

**short, clean, addictive gameplay where actual language knowledge changes what the player can do.**
