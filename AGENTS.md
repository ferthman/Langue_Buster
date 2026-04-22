# AGENTS.md

Operational guide for AI coding agents working on the **French Learning Mini App**.

This file defines how agents should behave, what they are allowed to change, how they should break work down, and which product constraints are non-negotiable.

The goal is simple: **ship a maintainable Telegram Mini App for learning French through a block-puzzle gameplay loop without turning the repository into spaghetti theatre**.

---

## 1. Project summary

### Product
A **Telegram Mini App** for learning French through game sessions inspired by the block-puzzle genre.

To place a block, the player must answer a language prompt correctly:
- Russian -> French
- French -> Russian
- later: phrase/context/grammar variants

### Learning structure
The app is organized by **CEFR levels**:
- A1
- A2
- B1
- B2
- C1
- C2

### MVP
The MVP is intentionally narrow:
- Russian UI
- French learning content
- A1 and A2 only
- Classic Run only
- placement test
- mastery tracking
- review queue
- editorial CMS
- analytics from day 1

### Core product truth
This is **not** a generic vocabulary app.
This is **not** a clone of Block Blast.
This is **not** a fully AI-generated language product.

It is a **learning game with deterministic puzzle rules and editorially controlled content**.

---

## 2. Primary engineering principles

Agents must follow these principles at all times.

### 2.1 Keep domain logic pure
Core gameplay and learning logic must live in framework-agnostic modules.

Examples:
- board validation
- line clear logic
- score calculation
- mastery updates
- answer evaluation rules
- review scheduling rules

These should not depend on:
- React
- Telegram SDK UI concerns
- browser globals unless explicitly wrapped
- database clients

### 2.2 Prefer explicit contracts
Use typed schemas and runtime validation for all boundary inputs.

Examples:
- API payloads
- Telegram auth data
- content imports
- admin form submission
- analytics event payloads

### 2.3 Product safety over cleverness
Do not optimize for novelty if it reduces clarity.

Bad:
- magic abstractions
- over-generalized game engine before the game exists
- auto-generated content pipelines with weak QA
- hidden side effects

Good:
- readable domain models
- deterministic functions
- traceable data flow
- small composable modules

### 2.4 No clone behaviour
Agents must not recreate copyrighted or brand-identical UI, names, icons, board visuals, sounds, or progression systems from existing puzzle games.

Genre inspiration is acceptable.
Asset mimicry is not.

### 2.5 MVP discipline
If a feature is not needed for the MVP, do not quietly sneak it in “because it might help later”.

That includes:
- PvP
- clans
- chat
- currencies beyond minimal XP/progression
- real-money monetization plumbing
- live multiplayer
- speech recognition
- advanced avatar systems

---

## 3. Expected repository shape

Agents should assume a monorepo like this unless the repository has already evolved with an approved alternative:

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

### Responsibility split
- `apps/miniapp` - Telegram Mini App frontend
- `apps/admin` - internal CMS / editorial interface
- `apps/api` - backend API, auth, game sessions, content delivery
- `packages/shared` - shared types, constants, validation helpers
- `packages/game-engine` - deterministic gameplay logic
- `packages/content-core` - content schemas, validation, import helpers
- `packages/ui` - shared UI components, design tokens, layout primitives
- `packages/analytics` - event definitions and tracking helpers
- `packages/config` - lint, tsconfig, environment, shared build config

If the actual repo differs, agents should follow the **same responsibility boundaries**.

---

## 4. Agent roles

Agents should work as **specialists**, not as one chaotic omnipotent goblin editing everything at once.

### 4.1 Product Architect Agent
Owns:
- system design
- package boundaries
- sequencing
- technical tradeoffs
- invariants

Should produce:
- architecture docs
- sequence diagrams
- task decomposition
- interface contracts

Should not:
- mass-edit UI code for cosmetic reasons
- rewrite stable modules without cause

### 4.2 Mini App Frontend Agent
Owns:
- Telegram Mini App integration
- React screens
- session UX
- onboarding
- game HUD
- animations and interaction polish

Should prioritize:
- responsiveness
- mobile ergonomics
- Telegram-safe layout
- clear loading and error states

Should not:
- invent backend contracts
- hardcode content that belongs in CMS
- duplicate game logic from `game-engine`

### 4.3 Backend Agent
Owns:
- auth
- session management
- API routes
- gameplay persistence
- anti-cheat baseline
- review/mastery persistence
- admin auth and permissions

Should prioritize:
- validation
- idempotency where needed
- clean service boundaries
- migration safety

Should not:
- move business logic into controllers
- trust client-submitted critical state without verification

### 4.4 Game Engine Agent
Owns:
- board model
- piece model
- placement validation
- scoring
- combo rules
- run-end rules
- deterministic seeds

Should produce:
- pure functions
- exhaustive tests
- reproducible simulations

Should not:
- depend on React or database code
- embed UI text
- embed analytics side effects

### 4.5 Content / Learning Logic Agent
Owns:
- vocabulary schema
- distractor rules
- answer types
- level mapping
- mastery logic
- spaced review logic
- placement test logic

Should prioritize:
- pedagogical correctness
- editorial traceability
- CEFR-informed organization
- no ambiguous answer sets

Should not:
- assume one “official” universal CEFR vocabulary list exists
- auto-publish AI-generated content without review status

### 4.6 CMS / Admin Agent
Owns:
- editorial dashboard
- vocab item CRUD
- lesson pack management
- review queues for editors
- publishing workflow
- import/export

Should prioritize:
- clarity
- bulk editing tools
- data validation
- auditability

Should not:
- bypass content statuses
- allow direct publishing of invalid items

### 4.7 Analytics Agent
Owns:
- event taxonomy
- tracking helper library
- event validation
- dashboard-facing event naming consistency

Should prioritize:
- stable event names
- backwards compatibility where possible
- privacy-respecting instrumentation

Should not:
- scatter raw event names all over the app
- track personally unnecessary sensitive information

### 4.8 QA / Test Agent
Owns:
- test plan
- regression cases
- smoke flows
- edge case enumeration
- content validation tests

Should prioritize:
- deterministic test cases
- gameplay edge cases
- auth failure paths
- content integrity

Should not:
- approve code with untested core mechanics

---

## 5. Critical invariants

These are non-negotiable. Agents must not violate them.

### 5.1 Telegram auth must be server-validated
Never trust Telegram `initData` only on the client.

### 5.2 Core game state must be reproducible
The same input state and seed must produce the same result.

### 5.3 Learning content must be editorially controlled
Every content item must have status and provenance.

### 5.4 One question must have one correct answer in MVP
Do not create ambiguous answer cards.

### 5.5 Board logic must be UI-independent
Frontend renders state. It does not define rules.

### 5.6 Content level mapping is product-defined, not mythical-official
Agents must not falsely claim a dataset is “the official CEFR word list” unless that is explicitly true and documented.

### 5.7 Russian UI is the MVP default
Do not silently switch product copy to English.

### 5.8 Launch scope is A1 + A2 only
Agents may prepare extensibility for more levels, but not expand launch scope by default.

---

## 6. Coding standards

### 6.1 Language and stack
- TypeScript end-to-end
- strict mode enabled
- ESLint + Prettier
- shared validation schemas

### 6.2 Style
Prefer:
- small functions
- explicit names
- flat data flow where practical
- typed return values
- domain-oriented naming

Avoid:
- giant utility dumping grounds
- hidden mutation
- unnecessary class hierarchies
- premature plugin systems

### 6.3 Comments
Write comments only where they add value:
- why, not what
- invariants
- edge case reasoning
- external constraints

Do not narrate obvious code.

### 6.4 Error handling
Errors must be:
- typed or normalized where relevant
- user-safe at the UI boundary
- logged with enough context on the server

Do not leak internal stack details into user-facing messages.

### 6.5 Validation
Use shared schemas for runtime boundaries.
Typical candidates:
- zod
- valibot
- equivalent approved validation tool

### 6.6 Config and secrets
Never hardcode secrets.
All env usage should be centralized and validated.

---

## 7. Database and migration rules

Agents working on persistence must follow these rules.

### 7.1 Migration safety
Every schema change must include:
- a migration
- rollback consideration
- updated types
- updated seed or fixtures if needed

### 7.2 Content entities must support workflow status
At minimum, vocab/content entities should support states like:
- draft
- on_review
- approved
- archived

### 7.3 Auditability
Important admin mutations should be traceable.
Where reasonable, store:
- created_by
- updated_by
- published_by
- published_at

### 7.4 Do not over-normalize too early
Use sane relational structure, but do not design a PhD thesis when the product only needs clean CRUD and validated delivery.

---

## 8. Content rules for agents

This project contains educational content. Agents must treat it carefully.

### 8.1 Required item shape
A vocab or learning item should generally support fields like:
- `id`
- `lemma`
- `surfaceForm`
- `pos`
- `gender`
- `article`
- `translationRu`
- `translationEn` optional
- `cefrLevel`
- `topic`
- `subtopic`
- `register`
- `exampleSentenceFr`
- `exampleSentenceRu`
- `distractors`
- `source`
- `frequencyScore`
- `status`
- `editorNotes`

Naming can follow repo conventions, but semantic coverage should remain.

### 8.2 Distractor policy
Distractors must be:
- plausible
- same part of speech where possible
- close in difficulty
- not accidentally correct
- grammatically compatible with the prompt format

### 8.3 Noun handling
French nouns must properly handle:
- article
- gender
- countability as relevant

Do not flatten everything into naked lemmas when article knowledge matters.

### 8.4 Verb handling
Do not mix raw infinitive prompts and conjugation prompts without explicit task type.

### 8.5 Editorial truth over model confidence
If content is uncertain, mark it for review.
Do not present guesses as cleanly validated pedagogical truth.

---

## 9. UX rules for agents

### 9.1 Telegram-first ergonomics
The Mini App must feel native inside Telegram:
- fast load
- touch-friendly layout
- clear safe area handling
- stable tap targets
- no hover-dependent interactions

### 9.2 Visual direction
Desired feel:
- clean
- warm
- modern
- readable
- lightly playful
- French-inspired without visual clichés

### 9.3 Gameplay screen priorities
The gameplay screen should emphasize:
1. score / hearts / streak
2. question card
3. board
4. piece tray

### 9.4 Performance matters
Animations should be snappy and not block interaction.
Do not ship performance-heavy effects that hurt low-end devices.

---

## 10. Analytics rules

Analytics must be planned, not sprinkled like confetti.

### 10.1 Event naming
Use centralized event constants and typed payloads.

### 10.2 Core MVP events
At minimum, support events like:
- app_opened
- auth_success
- onboarding_started
- placement_test_started
- placement_test_completed
- level_selected
- run_started
- question_shown
- answer_submitted
- answer_correct
- answer_wrong
- piece_placed
- line_cleared
- run_failed
- run_completed
- review_session_started
- review_item_answered
- cms_item_published

### 10.3 Privacy
Do not collect unnecessary personal data.
Track product behaviour, not user creepiness.

---

## 11. Testing rules

### 11.1 Core logic must be covered first
Top priority tests:
- board placement validation
- line clearing
- scoring
- combo updates
- run end detection
- answer evaluation
- mastery state transitions
- placement test scoring

### 11.2 Minimum test layers
Agents should aim for:
- unit tests for domain logic
- integration tests for API contracts
- smoke tests for major frontend flows

### 11.3 Edge cases to test
Examples:
- impossible piece placements
- last-heart failure
- repeated wrong answers
- ambiguous distractor set rejection
- tampered Telegram auth payload
- stale session refresh
- invalid content status transitions

### 11.4 Do not mark work done without tests
Especially for:
- auth
- engine
- learning logic
- migrations

---

## 12. Change policy

Agents must keep changes scoped.

### 12.1 Before editing
The agent should identify:
- goal
- modules affected
- risk level
- whether the change touches contracts or only internals

### 12.2 Allowed broad changes
Broad refactors are allowed only if one of these is true:
- current code is blocking implementation
- there is major duplication in a critical path
- the refactor is necessary for correctness
- the refactor has test coverage or is bundled with it

### 12.3 Avoid drive-by refactors
Do not rewrite unrelated files “while you’re there”.
That is how nice weekends die.

### 12.4 Preserve public contracts when possible
If you change:
- API route shape
- shared schema
- event payloads
- DB fields

then also update:
- docs
- tests
- consumers
- migration notes

---

## 13. Definition of Done

A task is done only if most of these apply:
- implementation is complete
- typing is correct
- tests exist or are updated
- lint passes
- build passes
- docs are updated if public contract changed
- no known broken flows were introduced
- no hidden TODOs for critical paths remain

For product-sensitive areas, also ensure:
- content logic is unambiguous
- UI copy is coherent in Russian
- event tracking is included if relevant
- error states are handled

---

## 14. Recommended execution order for agents

When building from near-zero, agents should work in this order:

1. **Architecture + repo bootstrap**
2. **Telegram auth + session layer**
3. **Core game engine**
4. **Content schema + editorial workflow basics**
5. **Answer evaluation + mastery domain**
6. **Mini App onboarding and shell screens**
7. **Classic Run screen integration**
8. **Review queue**
9. **Admin CMS**
10. **Analytics hardening**
11. **QA pass + polish**

This is intentional.
Do not start by polishing shadows on buttons before auth, engine, and content contracts exist.

---

## 15. Task decomposition template for agents

When taking a task, agents should structure work like this:

### Task
Clear one-sentence goal.

### Inputs
Files, modules, constraints, and contracts involved.

### Outputs
Exact code, tests, docs, or migrations expected.

### Risks
What could break.

### Steps
Ordered implementation plan.

### Validation
How success is checked.

Example:

```md
Task: Implement deterministic piece placement validation in packages/game-engine.

Inputs:
- board model
- piece model
- existing score rules

Outputs:
- placement validator
- tests for valid/invalid placements
- serialization-safe state helper

Risks:
- off-by-one board indexing
- mismatch between frontend preview and engine logic

Steps:
1. Add board and cell types
2. Implement pure placement check
3. Add applyPlacement helper
4. Add tests for edges and overlaps
5. Export stable API from package entry

Validation:
- unit tests pass
- identical state produces identical result
```

---

## 16. What agents must never do

### Never do this
- claim content is officially CEFR-certified when it is not
- clone a commercial puzzle game’s identity
- bypass server validation for Telegram auth
- trust client score submissions blindly
- hardcode untranslated product copy all over the app
- publish ambiguous learning items
- introduce large dependencies without reason
- rewrite stable modules for style points
- expand MVP scope without explicit approval

### Also never do this sneaky nonsense
- leave broken tests with a note saying “fix later” on core paths
- add “temporary” admin bypasses that will obviously survive into production
- split obvious business logic between client and server inconsistently
- bury event names as raw strings in random components

---

## 17. Good prompts for coding agents

These prompt patterns are recommended when delegating work to Codex or another code agent.

### Prompt template: implementation

```md
You are working inside the French Learning Mini App monorepo.
Read AGENTS.md, README.md, and plan.md first.

Task:
Implement [specific task].

Constraints:
- keep domain logic pure
- use existing package boundaries
- do not expand MVP scope
- add tests for core logic
- update docs if public contracts change

Deliver:
1. code changes
2. tests
3. short summary of what changed
4. any follow-up risks or TODOs
```

### Prompt template: review

```md
Review the current implementation against AGENTS.md.
Focus on:
- correctness
- scope discipline
- contract safety
- test coverage
- maintainability

Return:
- critical issues
- medium issues
- low-priority improvements
- exact files affected
```

### Prompt template: content tooling

```md
Implement content import validation for vocab items.
Requirements:
- reject missing required fields
- reject ambiguous distractors
- support content statuses
- produce actionable validation errors for editors
- add tests
```

---

## 18. Final operating rule

When in doubt, agents should prefer:
- clearer over cleverer
- deterministic over magical
- scoped over sprawling
- editorial control over content roulette
- maintainable velocity over fake speed

Build it so a human team can actually run this product after the first burst of enthusiasm wears off.
