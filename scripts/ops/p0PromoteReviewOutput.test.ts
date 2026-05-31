import { describe, expect, it } from 'vitest'
import { formatP0PromoteReview } from './p0PromoteReviewOutput'
import type { P0PromoteReviewResult } from './p0PromoteReviewTypes'

const buildResult = (): P0PromoteReviewResult => ({
  pass: false,
  inputs: {
    districtId: 'xinyi',
    sourcePath: '.tmp/xinyi-review.csv',
    reviewsPath: '.tmp/xinyi-next-review.csv',
    mergedOutPath: '.tmp/xinyi-review.merged.csv',
    configPath: 'configs/prod/xinyi.json',
    outDir: null,
  },
  apply: {
    sourcePath: '.tmp/xinyi-review.csv',
    reviewsPath: '.tmp/xinyi-next-review.csv',
    outPath: '.tmp/xinyi-review.merged.csv',
    manifestPath: null,
    totalReviewRows: 4,
    reviewedInputRows: 0,
    skippedBlankRows: 4,
    appliedRows: 0,
    errors: ['No reviewed rows found in review handoff CSV. Fill reviewStatus before applying.'],
    warnings: ['4 handoff row(s) have blank reviewStatus and were skipped.'],
    pass: false,
  },
  gate: null,
  errors: ['No reviewed rows found in review handoff CSV. Fill reviewStatus before applying.'],
  warnings: ['4 handoff row(s) have blank reviewStatus and were skipped.'],
})

const buildPassResult = (): P0PromoteReviewResult =>
  ({
    pass: true,
    inputs: {
      districtId: 'xinyi',
      sourcePath: '.tmp/xinyi-review.csv',
      reviewsPath: '.tmp/xinyi-next-review.csv',
      mergedOutPath: '.tmp/xinyi-review.merged.csv',
      configPath: 'configs/prod/xinyi.json',
      outDir: null,
    },
    apply: {
      sourcePath: '.tmp/xinyi-review.csv',
      reviewsPath: '.tmp/xinyi-next-review.csv',
      outPath: '.tmp/xinyi-review.merged.csv',
      manifestPath: '.tmp/xinyi-review.merged.manifest.json',
      totalReviewRows: 4,
      reviewedInputRows: 4,
      skippedBlankRows: 0,
      appliedRows: 4,
      errors: [],
      warnings: [],
      pass: true,
    },
    gate: {
      pass: true,
      outDir: 'data/overrides',
      summary: {
        totalRows: 80,
        reviewedRows: 4,
        validReviewedRows: 4,
      },
      preflight: {
        effectiveOverrides: 4,
        matchedSegmentOverrides: 4,
      },
      errors: [],
      warnings: [],
    },
    errors: [],
    warnings: [],
  }) as unknown as P0PromoteReviewResult

const buildSourceReadyResult = (): P0PromoteReviewResult =>
  ({
    ...buildPassResult(),
    apply: null,
  }) as unknown as P0PromoteReviewResult

describe('formatP0PromoteReview', () => {
  it('formats a fail-closed handoff promotion result', () => {
    const output = formatP0PromoteReview(buildResult())

    expect(output).toContain('# P0 Promote Review: FAIL')
    expect(output).toContain('- Gate: not run')
    expect(output).toContain('Fill `reviewStatus`, `reviewNote`, and `createdAt`')
    expect(output).toContain('Do not fill statuses from product predictions')
    expect(output).toContain('No reviewed rows found in review handoff CSV')
  })

  it('includes publish report refresh in the success handoff', () => {
    const output = formatP0PromoteReview(buildPassResult())

    expect(output).toContain('# P0 Promote Review: PASS')
    expect(output).toContain('npm run ingest:all -- --configs "configs/prod/xinyi.json"')
    expect(output).toContain(
      'npm run ops:refresh-publish-report -- --config "configs/prod/xinyi.json"',
    )
    expect(output).toContain(
      'npm run ops:p0-readiness -- --review ".tmp/xinyi-review.merged.csv" --config "configs/prod/xinyi.json"',
    )
  })

  it('formats source-ready promotion without handoff apply', () => {
    const output = formatP0PromoteReview(buildSourceReadyResult())

    expect(output).toContain('# P0 Promote Review: PASS')
    expect(output).toContain('Source review CSV was already gate-ready')
    expect(output).toContain('- Apply: not run')
  })
})
