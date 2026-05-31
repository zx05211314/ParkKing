import { describe, expect, it } from 'vitest'
import { parseQaReviewChecklistArgs } from './qaReviewChecklistArgs'

describe('parseQaReviewChecklistArgs', () => {
  it('parses QA review checklist options', () => {
    const parsed = parseQaReviewChecklistArgs([
      'node',
      'qaReviewChecklist',
      '--input',
      'next-review.csv',
      '--source',
      'review.csv',
      '--out',
      'next-review.md',
      '--merged-out',
      'review.merged.csv',
      '--config',
      'xinyi.json',
      '--title',
      'Xinyi gate rows',
      '--json',
    ])

    expect(parsed).toEqual({
      inputPath: 'next-review.csv',
      sourcePath: 'review.csv',
      outPath: 'next-review.md',
      mergedOutPath: 'review.merged.csv',
      configPath: 'xinyi.json',
      title: 'Xinyi gate rows',
      json: true,
    })
  })
})
