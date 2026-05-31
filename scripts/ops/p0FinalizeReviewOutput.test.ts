import { describe, expect, it } from 'vitest'
import { formatP0FinalizeReview } from './p0FinalizeReviewOutput'
import type { P0FinalizeReviewResult } from './p0FinalizeReviewTypes'

const buildResult = (): P0FinalizeReviewResult =>
  ({
    pass: false,
    stage: 'readiness',
    inputs: {
      districtId: 'xinyi',
      sourcePath: '.tmp/xinyi-review.csv',
      reviewsPath: '.tmp/xinyi-next-review.csv',
      mergedOutPath: '.tmp/xinyi-review.merged.csv',
      configPath: 'configs/prod/xinyi.json',
      answerCasesPath: 'configs/prod/xinyi.answer-cases.json',
      outDir: null,
      publishReportPath: 'public/data/generated/ingest_all_report.json',
      noCleanup: true,
      allowPublishWarn: false,
      allowPublishFail: false,
      publishOverrideReason: null,
    },
    promote: {
      pass: true,
      apply: { appliedRows: 4 },
      gate: { preflight: { effectiveOverrides: 4 } },
    },
    ingest: {
      pass: true,
      error: null,
    },
    refresh: {
      datasetDir: 'public/data/generated/xinyi',
      summary: {
        datasetHash: 'dataset-hash',
      },
    },
    answerCases: {
      pass: true,
      casesWritten: 7,
    },
    readiness: {
      pass: false,
      publishGate: {
        pass: false,
      },
    },
    errors: ['Readiness remained blocked after finalize workflow.'],
    warnings: [],
  }) as unknown as P0FinalizeReviewResult

describe('formatP0FinalizeReview', () => {
  it('formats finalize progress and points readiness at the merged CSV', () => {
    const output = formatP0FinalizeReview(buildResult())

    expect(output).toContain('# P0 Finalize Review: FAIL')
    expect(output).toContain('- Promote: PASS')
    expect(output).toContain('- Ingest: PASS')
    expect(output).toContain('- Refresh publish report: PASS')
    expect(output).toContain('- Write answer cases: PASS')
    expect(output).toContain('- Readiness with merged CSV: FAIL')
    expect(output).toContain('- Answer cases written: 7')
    expect(output).toContain('- Allow publish WARN override: no')
    expect(output).toContain(
      'npm run ops:p0-readiness -- --review ".tmp/xinyi-review.merged.csv" --config "configs/prod/xinyi.json"',
    )
  })

  it('shows not run for refresh when finalize stops before that step', () => {
    const output = formatP0FinalizeReview({
      ...buildResult(),
      stage: 'promote',
      promote: {
        pass: false,
      },
      ingest: null,
      refresh: null,
      answerCases: null,
      readiness: null,
    } as unknown as P0FinalizeReviewResult)

    expect(output).toContain('- Refresh publish report: not run')
    expect(output).toContain('- Write answer cases: not run')
    expect(output).toContain('- Readiness with merged CSV: not run')
  })

  it('shows the manual answer-case command when generation fails', () => {
    const output = formatP0FinalizeReview({
      ...buildResult(),
      pass: false,
      stage: 'answerCases',
      answerCases: {
        pass: false,
        casesWritten: 0,
      },
      readiness: null,
    } as unknown as P0FinalizeReviewResult)

    expect(output).toContain('npm run ops:write-answer-cases')
    expect(output).toContain('--out "configs/prod/xinyi.answer-cases.json"')
  })

  it('points successful finalize runs at the P1 release gate', () => {
    const output = formatP0FinalizeReview({
      ...buildResult(),
      pass: true,
      stage: 'done',
      readiness: {
        pass: true,
        publishGate: {
          pass: true,
        },
      },
      errors: [],
    } as unknown as P0FinalizeReviewResult)

    expect(output).toContain(
      '- P0 finalize passed. The merged reviewed CSV, rebuilt pack, publish report, and readiness gate are aligned.',
    )
    expect(output).toContain('- Build production UI before release smoke: npm run build')
    expect(output).toContain('- Run full P1 release readiness: npm run ops:p1-release-readiness')
    expect(output).toContain(
      'npm run ops:smoke-ui-parking-answers-map:preview -- --cases "configs/prod/xinyi.answer-cases.json" --district xinyi --limit 1 --timeout-ms 25000',
    )
  })
})
