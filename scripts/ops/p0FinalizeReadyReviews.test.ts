import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseP0FinalizeReadyReviewsArgs,
  renderP0FinalizeReadyReviews,
  runP0FinalizeReadyReviews,
} from './p0FinalizeReadyReviews'
import type { P0FinalizeReviewParams, P0FinalizeReviewResult } from './p0FinalizeReviewTypes'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'p0-finalize-ready-reviews-'))

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
  await writeText(path.join(bundleDir, `${districtId}-review.csv`), 'copied source\n')
  await writeJson(path.join(bundleDir, `${districtId}-review.manifest.json`), {
    districtId,
    csvPath: sourcePath,
    rows: { total: 4 },
  })
  return { bundleDir, sourcePath, handoffPath }
}

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

describe('p0FinalizeReadyReviews', () => {
  it('parses options', () => {
    expect(
      parseP0FinalizeReadyReviewsArgs([
        'node',
        'p0FinalizeReadyReviews',
        '--review-root',
        '.tmp',
        '--config-root',
        'configs/expansion',
        '--district',
        'daan,zhongshan',
        '--publish-gate-summary',
        '.tmp/publish_gate_summary.json',
        '--execute',
        '--summary',
        '.tmp/summary.md',
        '--json',
      ]),
    ).toEqual({
      reviewRoot: '.tmp',
      configRoot: 'configs/expansion',
      districtIds: ['daan', 'zhongshan'],
      all: false,
      publishGateSummaryPath: '.tmp/publish_gate_summary.json',
      execute: true,
      summaryPath: '.tmp/summary.md',
      json: true,
    })
  })

  it('dry-runs ready bundles and skips pending bundles', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', readyRows('daan'))
    await writeBundle(root, 'zhongshan', [
      '2,zhongshan,s1,marked_space_park,,,',
    ])

    const result = await runP0FinalizeReadyReviews({
      reviewRoot: root,
      districtIds: ['daan', 'zhongshan'],
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(true)
    expect(result.mode).toBe('dry-run')
    expect(result.ready.map((entry) => entry.districtId)).toEqual(['daan'])
    expect(result.ready[0]?.result).toBeNull()
    expect(result.skipped).toEqual([
      {
        districtId: 'zhongshan',
        status: 'ready-for-review',
        reason: 'human review handoff is not ready to finalize',
      },
    ])
    expect(renderP0FinalizeReadyReviews(result)).toContain(
      'P0 finalize ready reviews: PASS',
    )
  })

  it('executes finalize only for ready bundles', async () => {
    const root = await makeTempRoot()
    const bundle = await writeBundle(root, 'daan', readyRows('daan'))
    const calls: P0FinalizeReviewParams[] = []

    const result = await runP0FinalizeReadyReviews({
      reviewRoot: root,
      configRoot: 'configs/expansion',
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      execute: true,
      finalize: async (params) => {
        calls.push(params)
        return finalizeResult(params)
      },
    })

    expect(result.pass).toBe(true)
    expect(result.mode).toBe('execute')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      districtId: 'daan',
      sourcePath: bundle.sourcePath,
      reviewsPath: bundle.handoffPath,
      mergedOutPath: bundle.sourcePath.replace(/\.csv$/i, '.merged.csv'),
      configPath: path.join('configs', 'expansion', 'daan.json'),
    })
    expect(result.ready[0]?.result?.stage).toBe('done')
  })

  it('blocks when no district filter or all flag is supplied', async () => {
    const root = await makeTempRoot()
    await writeBundle(root, 'daan', readyRows('daan'))
    let finalizeCalled = false

    const result = await runP0FinalizeReadyReviews({
      reviewRoot: root,
      publishGateSummaryPath: null,
      execute: true,
      finalize: async (params) => {
        finalizeCalled = true
        return finalizeResult(params)
      },
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain('Pass at least one --district value or --all.')
    expect(finalizeCalled).toBe(false)
  })
})
