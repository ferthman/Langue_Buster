# AGENTS.md

Operational guide for coding agents working on the **French Learning Mini App**.

This file defines how agents should behave, how work must be decomposed, which product rules are non-negotiable, and how to avoid turning the repository into elegant-looking nonsense.

The main objective is simple:

**ship a maintainable Telegram Mini App for learning French through a deterministic block-puzzle gameplay loop with editorially controlled content and clear product boundaries.**

---

## 1. Read this first

Before making meaningful changes, every agent must read:
- `README.md`
- `plan.md`
- `AGENTS.md`

Treat these three files as the current source of truth.
If older code or docs disagree with them, flag the mismatch instead of silently inventing a third reality.

---

## 2. Product summary

### Product
A Telegram Mini App for learning French through a puzzle loop.
To place a block, the player must answer a language question correctly.

### Learning directions
Supported or planned prompt directions include:
- Russian -> French
- French -> Russian
- phrase/context variants later

### Scope discipline
#### MVP
- Russian UI
- French learning content
- A1 and A2 only
- Classic Run only
- placement test
- mastery tracking
- review queue
- editorial CMS
- analytics baseline

#### v2.0 after MVP
- 5-heart balancing pass
- explicit short-cycle repetition in-run
- question card UX upgrade
- progression and return-behavior systems
- content cleanup and scale-up
- B1 preparation in controlled scope

### Core truth
This is:
- not a generic flashcard app;
- not a Block Blast clone;
- not a fully AI-generated content product.

It is a **learning game with deterministic puzzle rules and editorially controlled content**.

---

## 3. Canonical gameplay rules

Agents must not drift from these rules unless the docs are explicitly updated.

### Board and session
- board size: **8x8**
- tray size: **3 pieces**
- new set appears after all 3 pieces are used
- a move must be validated by deterministic engine logic

### Move gating
- every move requires answering a language question correctly
- default answer format is **4 options** with exactly **1 correct answer**
- correct answer unlocks placement
- wrong answer applies penalty and affects learning recovery state

### Run end conditions
A run ends when:
- hearts reach zero; or
- no legal placements remain for the available pieces

### Hearts
- older MVP baseline: **3 hearts**
- current preferred v2.0 default: **5 hearts**
- balancing experiments may test **4 / 5 / 6 hearts**

### Repetition
- wrong answer must feed a short-cycle recovery queue
- item should reappear after roughly **3-5 new prompts**
- current preferred v2 direction: **around 5 prompts later**

### Card types
Initial/early card types:
- single word translation
- short phrase translation
- article + noun selection

Agents must not casually add fancy task types that create ambiguity or scope inflation.

---

## 4. UX and design rules

### No clone behavior
Agents must not recreate copyrighted or brand-identical UI, names, board visuals, sounds, icons, motion language, or progression framing from existing commercial puzzle games.

Genre inspiration is allowed.
Asset mimicry is not.

### Canonical run layout
The gameplay screen should prioritize:
1. header with score, hearts, streak
2. question card
3. board
4. tray with 3 pieces

### Desired feel
- clean
- warm
- modern
- readable
- lightly playful
- French in vibe, not in stereotype spam

### Interaction rules
- large tap targets
- readable typography
- fast transitions
- short animations, roughly 120-220 ms
- obvious state change between locked move and unlocked move
- obvious correct / wrong / combo feedback
- dark mode support
- Telegram theme support

### Frontend ergonomics
Agents must optimize for Telegram mobile viewport.
Do not design like the user is sitting at a 32-inch monitor with a gaming mouse and infinite patience.

---

## 5. Primary engineering principles

### 5.1 Keep domain logic pure
Core gameplay and learning logic must live in framework-agnostic modules.

Examples:
- board validation
- line clear logic
- score calculation
- answer evaluation
- mastery updates
- review scheduling
- repetition queue timing

These must not depend directly on:
- React
- browser-only UI code
- Telegram UI state
- database clients

### 5.2 Prefer explicit contracts
Use typed schemas and runtime validation at every boundary.

Examples:
- API payloads
- Telegram auth payloads
- content imports
- admin submissions
- analytics events

### 5.3 Product safety over cleverness
Prefer:
- readable domain models
- deterministic functions
- testable modules
- explicit flow

Avoid:
- mystery abstractions
- accidental side effects
- over-generalized engines before the game needs them
- giant utility graveyards

### 5.4 MVP and v2 discipline
Do not quietly add features because they “might be useful later”.

Examples of forbidden quiet scope creep:
- PvP
- clans
- chat
- real-money economy plumbing
- voice recognition
- overbuilt avatar systems
- full multi-level expansion before A1/A2 quality is proven

---

## 6. Repository responsibility boundaries

Agents should assume a monorepo like this unless the actual repo has an approved equivalent:

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
- `apps/admin` - editorial CMS and internal tools
- `apps/api` - backend API, auth, sessions, persistence
- `packages/shared` - shared types, DTOs, constants, validation helpers
- `packages/game-engine` - deterministic gameplay logic
- `packages/content-core` - content schemas, import validation, learning rules
- `packages/ui` - shared UI primitives and design tokens
- `packages/analytics` - event definitions and tracking helpers
- `packages/config` - shared tooling and config

If the actual repo differs, keep the same responsibility boundaries anyway.

---

## 7. Agent role expectations

Agents should work as specialists, not as one chaotic goblin touching every layer at once.

### Product Architect Agent
Owns:
- system design
- boundaries
- invariants
- sequencing
- contract safety

### Mini App Frontend Agent
Owns:
- Telegram Mini App integration
- screens and interaction states
- game HUD
- question card UX
- animations and feedback polish

Must not:
- duplicate game engine logic in components
- invent backend contracts from thin air
- hardcode content that belongs in CMS

### Backend Agent
Owns:
- Telegram auth validation
- sessions
- game APIs
- run persistence
- anti-cheat baseline
- review/mastery persistence
- admin auth and permissions

Must not:
- trust critical client-submitted state without verification
- move business logic into controllers

### Game Engine Agent
Owns:
- board model
- piece model
- placement validation
- line clear logic
- scoring
- combo rules
- run-end checks
- deterministic seeds

Must produce:
- pure functions
- exhaustive tests
- reproducible results

### Content and Learning Agent
Owns:
- vocab schemas
- distractor rules
- answer logic
- mastery logic
- repetition scheduling
- placement test logic

Must not:
- claim a dataset is “the official CEFR list” unless that is explicitly documented and true
- auto-publish uncertain content

### CMS Agent
Owns:
- vocab CRUD
- lesson tooling
- bulk import
- preview
- review workflow
- publish/archive flow
- audit history

### Analytics Agent
Owns:
- event taxonomy
- typed tracking payloads
- naming consistency
- privacy-safe instrumentation

### QA Agent
Owns:
- regression coverage
- smoke flows
- edge case enumeration
- content validation checks

---

## 8. Critical invariants

These are non-negotiable.

### 8.1 Telegram auth must be server-validated
Never trust Telegram launch data only on the client.

### 8.2 Game logic must be reproducible
Same input state and seed must produce the same result.

### 8.3 Learning items must be editorially controlled
Every content item must have status and provenance.

### 8.4 One question must have one correct answer
Especially in MVP and early v2.
No ambiguous answer cards.

### 8.5 Board logic must be UI-independent
The frontend renders state.
It does not define the rules.

### 8.6 Russian UI is the default early product language
Do not silently convert the app into an English UI project.

### 8.7 Launch content quality beats content surface area
A larger broken course is not progress.

### 8.8 Wrong answers must contribute to learning recovery
A wrong answer is not just damage.
It must feed review logic.

---

## 9. Content rules

### Required semantic fields
A vocab item should generally support:
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

Naming can follow repo conventions, but the semantic coverage should remain.

### Distractor policy
Distractors must be:
- plausible
- same part of speech where possible
- similar difficulty
- not accidentally correct
- grammatically compatible with the prompt format

### Noun handling
French nouns must support:
- article
- gender
- prompt compatibility

Do not flatten meaningful noun learning into raw naked lemmas when the teaching goal includes article knowledge.

### Verb handling
Do not mix infinitive, conjugation, and usage-in-context prompts without explicit task typing.

### Editorial truth over agent confidence
If content is uncertain, mark it for review.
Do not bluff pedagogical certainty.

---

## 10. Analytics rules

Analytics must be centralized, typed, and boring in a good way.

### Event naming
Use shared constants and validated payloads.
Do not scatter raw event strings all over the codebase like confetti at a cheap wedding.

### Core events
At minimum, support events like:
- `app_opened`
- `auth_success`
- `onboarding_started`
- `placement_test_started`
- `placement_test_completed`
- `level_selected`
- `run_started`
- `question_shown`
- `answer_submitted`
- `answer_correct`
- `answer_wrong`
- `piece_placed`
- `line_cleared`
- `run_failed`
- `run_completed`
- `review_session_started`
- `review_item_answered`
- `cms_item_published`

### Privacy
Do not track unnecessary personal data.
Track product behavior, not weird voyeuristic trivia.

---

## 11. Testing rules

### Core logic gets tested first
Top priority:
- board placement validation
- line clearing
- scoring
- combo rules
- run-end detection
- answer evaluation
- repetition queue timing
- mastery transitions
- placement test scoring

### Minimum test layers
Aim for:
- unit tests for domain logic
- integration tests for API contracts
- smoke tests for major frontend flows

### Edge cases to cover
Examples:
- impossible piece placements
- last-heart failure
- repeated wrong answers
- duplicate resurfacing bug in repetition queue
- ambiguous distractor rejection
- tampered Telegram auth payload
- stale session refresh
- invalid content status transitions

### Done means tested
Do not mark critical logic done if the code only “looks right”.
That is how bugs get dressed up as confidence.

---

## 12. Change policy

### Before editing
The agent should identify:
- goal
- affected modules
- contract impact
- risk level
- whether the change is product, infra, or refactor work

### Allowed broad changes
Broad refactors are allowed only if:
- current structure blocks implementation
- duplication is severe in a critical path
- correctness requires it
- tests cover it or are added with it

### Avoid drive-by refactors
Do not rewrite unrelated files because you were “already in there”.
That is how neat intentions become archaeological debris.

### Preserve public contracts when possible
If changing:
- API shapes
- shared schemas
- event payloads
- DB fields
- gameplay defaults that other modules rely on

then also update:
- docs
- tests
- consumers
- migration notes where relevant

---

## 13. Definition of Done

A task is done only if most of these are true:
- implementation complete
- typing correct
- tests added or updated
- lint passes
- build passes
- docs updated if contracts changed
- no known broken core flows introduced
- no hidden critical TODOs left behind

For product-sensitive areas also confirm:
- content is unambiguous
- Russian UI copy is coherent
- relevant analytics are included
- error states are handled
- gameplay defaults still match docs

---

## 14. Recommended execution order

When building or extending from near-zero, work in this order:
1. architecture and repo bootstrap
2. Telegram auth and session layer
3. core game engine
4. content schema and editorial workflow basics
5. answer evaluation and mastery logic
6. Mini App onboarding and shell screens
7. Classic Run integration
8. repetition and review systems
9. CMS improvements
10. analytics hardening
11. QA and polish

Do not start by polishing shadows on buttons while auth, engine, and content contracts are still half-invented.

---

## 15. Task decomposition template

When taking a task, agents should frame it like this:

### Task
One-sentence objective.

### Inputs
Files, modules, constraints, contracts.

### Outputs
Code, tests, docs, migrations, or UI states expected.

### Risks
What can break.

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
- current run rules

Outputs:
- placement validator
- applyPlacement helper
- tests for valid and invalid placements

Risks:
- off-by-one indexing
- mismatch with frontend preview state

Steps:
1. Define stable board and cell types
2. Implement pure placement check
3. Implement applyPlacement helper
4. Add tests for edges and overlaps
5. Export stable package API

Validation:
- unit tests pass
- same state produces same result
```

---

## 16. Never do this

Agents must never:
- claim content is officially CEFR-certified when it is not
- clone another puzzle game's identity
- bypass server validation for Telegram auth
- trust client score submissions blindly
- publish ambiguous learning items
- hardcode product copy everywhere without structure
- add giant dependencies without strong reason
- rewrite stable modules for style points
- expand scope because enthusiasm temporarily outpaced judgment

And definitely do not leave broken critical tests with a note that basically says, “future me can suffer”.

---

## 17. Final operating rule

When in doubt, prefer:
- clearer over cleverer
- deterministic over magical
- scoped over sprawling
- editorial control over content roulette
- maintainable velocity over fake speed

Build it so a human team can still operate the product after the first burst of excitement wears off.
