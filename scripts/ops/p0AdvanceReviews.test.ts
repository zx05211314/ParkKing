import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseP0AdvanceReviewsArgs,
  renderP0AdvanceReviews,
  runP0AdvanceReviews,
} from './p0AdvanceReviews'
import type { P0FinalizeReviewParams, P0FinalizeReviewResult } from './p0FinalizeReviewTypes'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'p0-advance-reviews-'))

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const writeJson = async (targetPath: string, payload: unknown) =>
  writeText(targetPath, `${JSON.stringify(payload, null, 2)}\n`)

const writeBundle = async (
  root: string,
  districtId: string,
  handoffRows: string[],
) => {
  const bundleDir = path.join(root, `${districtId}-human-review`)
  const sourcePath = path.join(root, `${districtId}-review.csv`)
  const handoffPath = path.join(bundleDir, `${districtId}-next-review.csv`)
  await writeText(
    sourcePath,
    [
      'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
      `${districtId},s1,marked_space_park,,,`,
      `${districtId},s2,marked_space_park,,,`,
      `${districtId},s3,no_stop,,,`,
      `${districtId},s4,no_stop,,,`,
      '',
    ].join('\n'),
  )
  await writeText(path.join(bundleDir, `${districtId}-review.csv`), 'copied source\n')
  await writeText(
    handoffPath,
    [
      'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
      ...handoffRows,
      '',
    ].join('\n'),
  )
  await writeText(path.join(bundleDir, `${districtId}-next-review.md`), '# review\n')
  await writeText(path.join(bundleDir, `${districtId}-next-review.geojson`), '{}\n')
  await writeText(path.join(bundleDir, `${districtId}-review.review.md`), '# source\n')
  await writeJson(path.join(bundleDir, `${districtId}-review.manifest.json`), {
    districtId,
    csvPath: sourcePath,
    rows: { total: 4 },
  })
  return { bundleDir, sourcePath, handoffPath }
}

const pendingRows = (districtId: string) => [
  `2,${districtId},s1,marked_space_park,,,`,
  `3,${districtId},s2,marked_space_park,,,`,
  `4,${districtId},s3,no_stop,,,`,
  `5,${districtId},s4,no_stop,,,`,
]

const readyRows = (districtId: string) => [
  `2,${districtId},s1,marked_space_park,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z`,
  `3,${districtId},s2,marked_space_park,ILLEGAL,observed no parking sign,2026-05-10T00:00:00.000Z`,
  `4,${districtId},s3,no_stop,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z`,
  `5,${districtId},s4,no_stop,ILLEGAL,observed no stopping sign,2026-05-10T00:00:00.000Z`,
]

const finalizeResult = (params: P0FinalizeReviewParams): P0FinalizeReviewResult =>
  ({
    pass: true,
    stage: 'done',
    inputs: {
      districtId: params.districtId,
      sourcePath: params.sourcePath,
      reviewsPath: params.reviewsPath,
      mergedOutPath: params.mergedOutPath,
      configPath: params.configPath,
      answerCasesPath: 'configs/prod/daan.answer-cases.json',
      outDir: null,
      publishReportPath: null,
      noCleanup: false,
      allowPublishWarn: params.allowPublishWarn,
      allowPublishFail: false,
      publishOverrideReason: params.publishOverrideReason,
    },
    promote: null,
    ingest: null,
    refresh: null,
    answerCases: null,
    readiness: null,
    errors: [],
    warnings: [],
  }) as P0FinalizeReviewResult

describe('p0AdvanceReviews', () => {
  it('parses options', () => {
    expect(
      parseP0AdvanceReviewsArgs([
        'node',
        'p0AdvanceReviews',
        '--review-root',
        '.tmp',
        '--district',
        'daan,zhongshan',
        '--out-dir',
        '.tmp/reviews',
        '--publish-gate-summary',
        '.tmp/publish_gate_summary.json',
        '--require-ready-to-finalize',
        '--review-intake',
        '--scan-dir',
        '.tmp/returned',
        '--include-common-dirs',
        '--validate-ready',
        '--actionable-only',
        '--no-package',
        '--execute',
        '--out',
        '.tmp/advance.md',
        '--json-out',
        '.tmp/advance.json',
        '--summary',
        '.tmp/summary.md',
        '--json',
        '--report-only',
      ]),
    ).toEqual({
      reviewRoot: '.tmp',
      districtIds: ['daan', 'zhongshan'],
      all: false,
      outDir: '.tmp/reviews',
      publishGateSummaryPath: '.tmp/publish_gate_summary.json',
      requireReadyToFinalize: true,
      reviewIntake: true,
      reviewIntakeScanDirs: ['.tmp/returned'],
      includeCommonDirs: true,
      validateReadyIntake: true,
      reviewIntakeActionableOnly: true,
      noPackage: true,
      execute: true,
      outPath: '.tmp/advance.md',
      jsonOutPath: '.tmp/advance.json',
      summaryPath: '.tmp/summary.md',
      json: true,
      reportOnly: true,
    })
  })

  it('packages ready-for-review bundles without finalizing them', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    await writeBundle(root, 'daan', pendingRows('daan'))

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      outDir,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      now: new Date('2026-05-10T00:00:00.000Z'),
    })

    expect(result.pass).toBe(true)
    expect(result.status).toBe('action-required')
    expect(result.entries).toEqual([
      {
        districtId: 'daan',
        status: 'ready-for-review',
        nextAction: 'package-human-review',
      },
    ])
    expect(result.auditResult?.entries).toHaveLength(1)
    expect(result.auditResult?.entries[0]?.pendingRows).toBe(4)
    expect(result.packageResult?.packages).toHaveLength(1)
    expect(result.reviewIntakeResult).toBeNull()
    expect(result.finalizeResult).toBeNull()
    expect(renderP0AdvanceReviews(result)).toContain('P0 advance reviews: ACTION-REQUIRED')
  })

  it('can include returned-review intake in the advance report', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    const returnedDir = path.join(root, 'returned')
    await writeBundle(root, 'daan', pendingRows('daan'))
    await writeText(
      path.join(returnedDir, 'daan-priority-review.csv'),
      [
        'districtId,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,2,s1,marked_space_park,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      outDir,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      reviewIntake: true,
      reviewIntakeScanDirs: [returnedDir],
      now: new Date('2026-05-10T00:00:00.000Z'),
    })

    expect(result.pass).toBe(true)
    expect(result.reviewIntakeResult?.status).toBe('ready-to-validate')
    expect(result.reviewIntakeResult?.candidates[0]?.validationCommand).toContain(
      'npm run ops:p0-validate-priority-review -- --district daan',
    )
    expect(renderP0AdvanceReviews(result)).toContain('## Review Intake')
  })

  it('treats validated returned priority reviews as ready for the strict gate', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    const returnedCsv = path.join(root, 'returned', 'daan-priority-review.csv')
    const filteredCsv = path.join(root, 'daan-priority-review.filtered.csv')
    const mergedCsv = path.join(root, 'daan-priority-review.merged.csv')
    const configPath = path.join(root, 'daan.json')
    await writeBundle(root, 'daan', pendingRows('daan'))

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      outDir,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      reviewIntake: true,
      validateReadyIntake: true,
      requireReadyToFinalize: true,
      reviewIntakeScanner: async () => ({
        pass: true,
        status: 'ready-to-finalize',
        reviewRoot: root,
        scanDirs: [path.dirname(returnedCsv)],
        selectedDistricts: ['daan'],
        scannedFiles: 1,
        candidates: [
          {
            districtId: 'daan',
            filePath: returnedCsv,
            totalRows: 1,
            relevantRows: 1,
            reviewedRows: 1,
            validReviewedRows: 1,
            invalidStatusRows: 0,
            invalidTimestampRows: 0,
            missingEvidenceRows: 0,
            statusCounts: { LEGAL: 1 },
            reviewedBucketCounts: { marked_space_park: 1 },
            isCanonicalHandoff: true,
            hasSourceRowNumber: true,
            hasReviewIdentity: true,
            nextAction: 'finalize-review',
            validationCommand:
              'npm run ops:p0-validate-priority-review -- --district daan',
            validation: {
              pass: true,
              districtId: 'daan',
              sourcePath: path.join(root, 'daan-review.csv'),
              reviewsPath: returnedCsv,
              filteredReviewsOutPath: filteredCsv,
              mergedOutPath: mergedCsv,
              configPath,
              outDir: path.join(root, 'overrides'),
              priorityRows: 1,
              filteredRows: 1,
              promote: null,
              finalizeCommand: 'npm run ops:p0-finalize-review -- --district daan',
              errors: [],
              warnings: [],
            },
            finalizeCommand: 'npm run ops:p0-finalize-review -- --district daan',
          },
        ],
        errors: [],
        warnings: [],
      }),
    })

    expect(result.pass).toBe(true)
    expect(result.status).toBe('ready-to-finalize')
    expect(result.auditResult).toBeNull()
    expect(result.packageResult).toBeNull()
    expect(result.intakeFinalizeResults).toHaveLength(1)
    expect(result.intakeFinalizeResults[0]?.result).toBeNull()
    expect(renderP0AdvanceReviews(result)).toContain('Finalize daan:')
  })

  it('executes finalize for validated returned priority reviews', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    const returnedCsv = path.join(root, 'returned', 'daan-priority-review.csv')
    const sourcePath = path.join(root, 'daan-review.csv')
    const filteredCsv = path.join(root, 'daan-priority-review.filtered.csv')
    const mergedCsv = path.join(root, 'daan-priority-review.merged.csv')
    const configPath = path.join(root, 'daan.json')
    await writeBundle(root, 'daan', pendingRows('daan'))
    const calls: P0FinalizeReviewParams[] = []

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      outDir,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      reviewIntake: true,
      validateReadyIntake: true,
      requireReadyToFinalize: true,
      execute: true,
      finalize: async (params) => {
        calls.push(params)
        return finalizeResult(params)
      },
      reviewIntakeScanner: async () => ({
        pass: true,
        status: 'ready-to-finalize',
        reviewRoot: root,
        scanDirs: [path.dirname(returnedCsv)],
        selectedDistricts: ['daan'],
        scannedFiles: 1,
        candidates: [
          {
            districtId: 'daan',
            filePath: returnedCsv,
            totalRows: 1,
            relevantRows: 1,
            reviewedRows: 1,
            validReviewedRows: 1,
            invalidStatusRows: 0,
            invalidTimestampRows: 0,
            missingEvidenceRows: 0,
            statusCounts: { LEGAL: 1 },
            reviewedBucketCounts: { marked_space_park: 1 },
            isCanonicalHandoff: true,
            hasSourceRowNumber: true,
            hasReviewIdentity: true,
            nextAction: 'finalize-review',
            validationCommand:
              'npm run ops:p0-validate-priority-review -- --district daan',
            validation: {
              pass: true,
              districtId: 'daan',
              sourcePath,
              reviewsPath: returnedCsv,
              filteredReviewsOutPath: filteredCsv,
              mergedOutPath: mergedCsv,
              configPath,
              outDir: path.join(root, 'overrides'),
              priorityRows: 1,
              filteredRows: 1,
              promote: null,
              finalizeCommand: 'npm run ops:p0-finalize-review -- --district daan',
              errors: [],
              warnings: [],
            },
            finalizeCommand: 'npm run ops:p0-finalize-review -- --district daan',
          },
        ],
        errors: [],
        warnings: [],
      }),
    })

    expect(result.pass).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.finalizeResult).toBeNull()
    expect(result.auditResult).toBeNull()
    expect(result.packageResult).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      districtId: 'daan',
      sourcePath,
      reviewsPath: filteredCsv,
      mergedOutPath: mergedCsv,
      configPath,
    })
    expect(result.intakeFinalizeResults[0]?.result?.stage).toBe('done')
    expect(renderP0AdvanceReviews(result)).toContain('## Intake Finalize')
  })

  it('dry-runs finalize commands for ready bundles', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', readyRows('daan'))

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(true)
    expect(result.status).toBe('ready-to-finalize')
    expect(result.auditResult).toBeNull()
    expect(result.packageResult).toBeNull()
    expect(result.finalizeResult?.ready.map((entry) => entry.districtId)).toEqual([
      'daan',
    ])
    expect(result.finalizeResult?.ready[0]?.result).toBeNull()
  })

  it('fails require-ready-to-finalize while still reporting review packages', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    await writeBundle(root, 'daan', pendingRows('daan'))

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      outDir,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      requireReadyToFinalize: true,
      now: new Date('2026-05-10T00:00:00.000Z'),
    })

    expect(result.pass).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.errors).toContain(
      'Require-ready-to-finalize failed; not ready for finalize: daan',
    )
    expect(result.packageResult?.packages).toHaveLength(1)
    expect(renderP0AdvanceReviews(result)).toContain(
      'P0 advance reviews: BLOCKED',
    )
  })

  it('can run strict ready checks without writing review packages', async () => {
    const root = await makeTempRoot()
    const outDir = path.join(root, 'out')
    await writeBundle(root, 'daan', pendingRows('daan'))

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      outDir,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      requireReadyToFinalize: true,
      noPackage: true,
      now: new Date('2026-05-10T00:00:00.000Z'),
      packageReviews: async () => {
        throw new Error('packageReviews should not be called')
      },
    })

    expect(result.pass).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.auditResult?.entries).toHaveLength(1)
    expect(result.packageResult).toBeNull()
    expect(result.errors).toContain(
      'Require-ready-to-finalize failed; not ready for finalize: daan',
    )
    expect(result.warnings).toContain('Packaging skipped by --no-package for: daan')
    expect(renderP0AdvanceReviews(result)).toContain(
      'Packaging skipped by --no-package for: daan',
    )
  })

  it('executes finalize only for ready bundles', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', readyRows('daan'))
    const calls: P0FinalizeReviewParams[] = []

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      execute: true,
      finalize: async (params) => {
        calls.push(params)
        return finalizeResult(params)
      },
    })

    expect(result.pass).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.auditResult).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.districtId).toBe('daan')
    expect(result.finalizeResult?.ready[0]?.result?.stage).toBe('done')
  })

  it('blocks without district filter or all flag', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', pendingRows('daan'))

    const result = await runP0AdvanceReviews({
      reviewRoot: root,
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.errors).toContain('Pass at least one --district value or --all.')
    expect(result.packageResult).toBeNull()
  })
})
