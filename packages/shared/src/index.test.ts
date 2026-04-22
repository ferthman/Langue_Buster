import { describe, expect, it } from 'vitest';

import { launchLevels, runSessionSchema } from './index.js';

describe('shared domain contracts', () => {
  it('keeps MVP launch levels constrained to A1 and A2', () => {
    expect(launchLevels).toEqual(['A1', 'A2']);
  });

  it('validates a basic run session payload', () => {
    expect(() =>
      runSessionSchema.parse({
        id: 'run_1',
        levelId: 'A1',
        direction: 'ru_to_fr',
        heartsRemaining: 3,
        score: 0,
        combo: 0,
      }),
    ).not.toThrow();
  });
});
