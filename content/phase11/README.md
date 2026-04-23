# Phase 11 Launch Content

Source artifacts live in:

- `packages/content-core/src/phase11-source-lists.ts`
- `packages/content-core/src/phase11-launch-pack.ts`

The canonical launch bundle is `phase11LaunchBundle`.

To print the JSON bundle for the Phase 10 CMS import screen:

```bash
corepack pnpm --filter @langue-buster/content-core build
corepack pnpm --filter @langue-buster/content-core phase11:print-bundle > /tmp/phase11-launch-bundle.json
```

Then upload or paste `/tmp/phase11-launch-bundle.json` in the Admin CMS import screen.

Validation/QA coverage:

- bundle schema validation
- lesson/topic/level reference integrity
- distractor compatibility and duplicate-label checks
- noun article/gender coverage
- Phase 6 question-generation compatibility for all approved items
