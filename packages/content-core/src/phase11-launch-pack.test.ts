import { describe, expect, it } from 'vitest';

import { validateEditorialImportBundle } from './index.js';
import {
  findPhase11LaunchIssues,
  phase11LaunchBundle,
  phase11LaunchQaSnapshot,
  phase11SourceListCounts,
} from './phase11-launch-pack.js';
import { phase11LessonDefinitions, phase11SourceLists, phase11TopicDefinitions } from './phase11-source-lists.js';

describe('phase 11 launch content pack', () => {
  it('provides A1 and A2 source lists with launch-scale volume', () => {
    expect(phase11SourceLists.A1).toHaveLength(168);
    expect(phase11SourceLists.A2).toHaveLength(168);
    expect(phase11SourceListCounts.total).toBe(336);
  });

  it('builds a valid editorial import bundle for A1 and A2', () => {
    const validation = validateEditorialImportBundle(phase11LaunchBundle);

    expect(validation.success).toBe(true);
    expect(phase11LaunchBundle.vocabItems).toHaveLength(336);
    expect(phase11LaunchBundle.distractorSets).toHaveLength(336);
    expect(phase11LaunchBundle.topics).toHaveLength(phase11TopicDefinitions.length);
    expect(phase11LaunchBundle.lessons).toHaveLength(phase11LessonDefinitions.length);
    expect(phase11LaunchBundle.levels.map((level) => level.id)).toEqual(['A1', 'A2']);
  });

  it('marks the entire launch pack as approved and publishable', () => {
    expect(phase11LaunchBundle.vocabItems.every((item) => item.status === 'approved')).toBe(true);
    expect(phase11LaunchBundle.distractorSets.every((set) => set.status === 'approved')).toBe(true);
    expect(phase11LaunchBundle.topics.every((topic) => topic.status === 'approved')).toBe(true);
    expect(phase11LaunchBundle.lessons.every((lesson) => lesson.status === 'approved')).toBe(true);
    expect(phase11LaunchBundle.levels.every((level) => level.status === 'approved')).toBe(true);
  });

  it('has article and gender coverage for every noun-like item', () => {
    const nounLikeItems = phase11LaunchBundle.vocabItems.filter((item) => item.partOfSpeech === 'noun' || item.itemType === 'article_noun');

    expect(nounLikeItems.length).toBeGreaterThan(200);
    expect(nounLikeItems.every((item) => typeof item.article === 'string' && typeof item.gender === 'string')).toBe(true);
  });

  it('passes ambiguity and question-generation QA with zero blocking issues', () => {
    expect(findPhase11LaunchIssues(phase11LaunchBundle)).toEqual([]);
    expect(phase11LaunchQaSnapshot.issueCount).toBe(0);
  });

  it('detects duplicate normalized distractor labels in a tampered bundle', () => {
    const firstSet = phase11LaunchBundle.distractorSets[0];
    if (!firstSet) {
      throw new Error('Expected launch distractor set.');
    }

    const tampered = {
      ...phase11LaunchBundle,
      distractorSets: [
        {
          ...firstSet,
          options: [
            { ...firstSet.options[0] },
            { ...firstSet.options[1], label: firstSet.options[0].label.toUpperCase() },
            ...firstSet.options.slice(2),
          ],
        },
        ...phase11LaunchBundle.distractorSets.slice(1),
      ],
    };

    const issues = findPhase11LaunchIssues(tampered);
    expect(issues.some((issue) => issue.code === 'distractor_invalid' || issue.code === 'schema_invalid')).toBe(true);
  });
});
