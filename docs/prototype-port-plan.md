# Prototype Port Plan

## Goal

Port the ZIP prototype into the monorepo as the real baseline for the run screen while preserving package boundaries, Russian product UI, and deterministic gameplay/content logic.

## What Was Ported Directly From the ZIP

- run screen composition: top HUD, large question card, central board, bottom tray;
- mobile-first spacing hierarchy and card sizing;
- direct manipulation feel between tray and board;
- puzzle-first visual rhythm where the board stays central during the answer flow;
- HUD structure with score, streak, hearts, and menu affordance.

## What Was Adapted

- prototype click/hover placement was upgraded to true pointer/touch drag-and-drop;
- question UI copy was normalized to Russian while keeping French only in learning prompts/options;
- move flow was connected to server-backed run APIs instead of local demo state;
- preview and drop validation now read from `packages/game-engine` rather than component-local helpers;
- wrong-answer recovery remains in `packages/content-core` with deterministic short-cycle resurfacing.

## What Was Replaced For Clone-Risk Reasons

- suspicious imported prototype art and glossy commercial-style assets were not reused;
- board/piece rendering now uses internal gradients, glass surfaces, highlights, and safer geometric styling;
- no external brand-like icons, logos, or copied board textures were carried into the monorepo.

## Drag-And-Drop Implementation

- tray slots start drag on pointer/touch down when the move is unlocked;
- a floating piece lifts out of the tray and follows the pointer;
- board preview is recomputed live from `canPlacePiece(...)` in `packages/game-engine`;
- valid placements highlight the target cells in green/mint tones;
- invalid placements highlight rejection in pink/red tones;
- pointer release on a valid origin calls the existing move API immediately;
- invalid release triggers a snap-back animation to the tray slot.

## Architecture Notes

- `packages/game-engine` remains the source of truth for placement validation, clears, scoring, and move availability;
- `packages/content-core` remains the source of truth for question generation and short-cycle recovery;
- `apps/miniapp` owns only rendering, local drag state, animation glue, and Telegram-friendly feedback.

## Remaining Polish

- add a dedicated pause/settings overlay instead of the current minimal finish affordance;
- add stronger correct/wrong transition animation around the question card;
- expose richer end-of-run recap for weak words and resurfaced items;
- add one-handed ergonomics tuning after device testing inside Telegram.
