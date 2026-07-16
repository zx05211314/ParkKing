import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseHumanReviewBundleIndexArgs,
  renderHumanReviewBundleIndex,
  resolveHumanReviewBundleIndexSummaryPath,
  runHumanReviewBundleIndex,
} from './humanReviewBundleIndex'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'human-review-bundle-index-'))

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const writeJson = async (targetPath: string, payload: unknown) =>
  writeText(targetPath, `${JSON.stringify(payload, null, 2)}\n`)

const writeBundleFiles = async (
  root: string,
  districtId: string,
  sourceCsv: string,
  handoffCsv: string,
) => {
  const bundleDir = path.join(root, `${districtId}-human-review`)
  const sourcePath = path.join(bundleDir, `${districtId}-review.csv`)
  await writeText(sourcePath, sourceCsv)
  await writeText(path.join(bundleDir, `${districtId}-next-review.csv`), handoffCsv)
  await writeText(path.join(bundleDir, `${districtId}-next-review.md`), '# review\n')
  await writeText(path.join(bundleDir, `${districtId}-next-review.geojson`), '{}\n')
  await writeText(path.join(bundleDir, `${districtId}-review.review.md`), '# source\n')
  await writeJson(path.join(bundleDir, `${districtId}-review.manifest.json`), {
    districtId,
    csvPath: sourcePath,
    dataset: {
      baseDir: path.join(root, 'data', districtId),
      datasetHash: `${districtId}-hash`,
      configHash: `${districtId}-config`,
      generatedAt: '2026-05-10T00:00:00.000Z',
    },
    params: {
      strategy: 'review',
      hhmm: '21:00',
      topN: 80,
    },
    rows: {
      total: sourceCsv.trim().split('\n').length - 1,
    },
  })
  return bundleDir
}

describe('humanReviewBundleIndex', () => {
  it('parses bundle index options', () => {
    expect(
      parseHumanReviewBundleIndexArgs([
        'node',
        'humanReviewBundleIndex',
        '--review-root',
        '.tmp',
        '--config-root',
        'configs/expansion',
        '--district',
        'daan,zhongshan',
        '--publish-gate-summary',
        '.tmp/publish_gate_summary.json',
        '--require-ready-to-finalize',
        '--out',
        '.tmp/index.md',
        '--json-out',
        '.tmp/index.json',
        '--summary',
        '.tmp/summary.md',
        '--json',
      ]),
    ).toEqual({
      reviewRoot: '.tmp',
      configRoot: 'configs/expansion',
      districtIds: ['daan', 'zhongshan'],
      publishGateSummaryPath: '.tmp/publish_gate_summary.json',
      requireReadyToFinalize: true,
      outPath: '.tmp/index.md',
      jsonOutPath: '.tmp/index.json',
      summaryPath: '.tmp/summary.md',
      json: true,
    })
  })

  it('uses GITHUB_STEP_SUMMARY when no explicit summary is passed', () => {
    expect(
      resolveHumanReviewBundleIndexSummaryPath(
        {},
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/workflow-summary.md')
  })

  it('indexes ready-for-review and complete bundles', async () => {
    const root = await makeTempRoot()
    await writeBundleFiles(
      root,
      'daan',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,s1,marked_space_park,,,',
        'daan,s2,no_stop,,,',
        '',
      ].join('\n'),
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,daan,s1,marked_space_park,,,',
        '3,daan,s2,no_stop,,,',
        '',
      ].join('\n'),
    )
    await writeBundleFiles(
      root,
      'xinyi',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,s1,marked_space_park,LEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s2,marked_space_park,ILLEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s3,no_stop,LEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s4,no_stop,ILLEGAL,observed,2026-05-10T00:00:00.000Z',
        '',
      ].join('\n'),
      'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt\n',
    )

    const result = await runHumanReviewBundleIndex({
      reviewRoot: root,
      publishGateSummaryPath: null,
    })
    const daan = result.entries.find((entry) => entry.districtId === 'daan')
    const xinyi = result.entries.find((entry) => entry.districtId === 'xinyi')
    const rendered = renderHumanReviewBundleIndex(result)

    expect(daan).toMatchObject({
      status: 'ready-for-review',
      handoffRows: 2,
      handoffValidReviewedRows: 0,
      validReviewedRows: 0,
      estimatedMinimumNewReviews: 4,
      missingStatuses: ['LEGAL', 'ILLEGAL'],
    })
    expect(xinyi).toMatchObject({
      status: 'review-complete',
      handoffRows: 0,
      validReviewedRows: 4,
      estimatedMinimumNewReviews: 0,
    })
    expect(result.finalizeReadyCount).toBe(1)
    expect(result.notReadyForFinalize).toEqual(['daan'])
    expect(rendered).toContain('Human review bundle index: WARN')
    expect(rendered).toContain('Finalize-ready bundles: 1/2')
    expect(rendered).toContain('npm run ops:p0-finalize-review -- --district daan')
  })

  it('marks a bundle ready-to-finalize when the handoff CSV satisfies P0 review requirements', async () => {
    const root = await makeTempRoot()
    await writeBundleFiles(
      root,
      'daan',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,s1,marked_space_park,,,',
        'daan,s2,marked_space_park,,,',
        'daan,s3,no_stop,,,',
        'daan,s4,no_stop,,,',
        '',
      ].join('\n'),
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,daan,s1,marked_space_park,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z',
        '3,daan,s2,marked_space_park,ILLEGAL,observed no parking sign,2026-05-10T00:00:00.000Z',
        '4,daan,s3,no_stop,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z',
        '5,daan,s4,no_stop,ILLEGAL,observed no stopping sign,2026-05-10T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runHumanReviewBundleIndex({
      reviewRoot: root,
      publishGateSummaryPath: null,
    })
    const daan = result.entries[0]

    expect(daan).toMatchObject({
      status: 'ready-to-finalize',
      handoffRows: 4,
      handoffValidReviewedRows: 4,
      handoffEstimatedMinimumNewReviews: 0,
      validReviewedRows: 0,
    })
    expect(result.finalizeReadyCount).toBe(1)
    expect(result.notReadyForFinalize).toEqual([])
    expect(renderHumanReviewBundleIndex(result)).toContain('ready-to-finalize')
  })

  it('does not mark a handoff ready to finalize when review timestamps are invalid', async () => {
    const root = await makeTempRoot()
    await writeBundleFiles(
      root,
      'daan',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,s1,marked_space_park,,,',
        'daan,s2,marked_space_park,,,',
        'daan,s3,no_stop,,,',
        'daan,s4,no_stop,,,',
        '',
      ].join('\n'),
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,daan,s1,marked_space_park,LEGAL,observed legal curb sign,not-a-date',
        '3,daan,s2,marked_space_park,ILLEGAL,observed no parking sign,2026-05-10T00:00:00.000Z',
        '4,daan,s3,no_stop,LEGAL,observed legal curb sign,2026-05-10T00:00:00.000Z',
        '5,daan,s4,no_stop,ILLEGAL,observed no stopping sign,2026-05-10T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runHumanReviewBundleIndex({
      reviewRoot: root,
      publishGateSummaryPath: null,
    })
    const daan = result.entries[0]

    expect(daan).toMatchObject({
      status: 'incomplete',
      handoffRows: 4,
    })
    expect(result.finalizeReadyCount).toBe(0)
    expect(result.notReadyForFinalize).toEqual(['daan'])
    expect(result.errors).toContain(
      '[daan] Handoff: 1 reviewed row(s) have invalid createdAt timestamps; createdAt must be an ISO timestamp with timezone, for example 2026-05-22T12:00:00.000Z.',
    )
  })

  it('filters bundles by district id or bundle id', async () => {
    const root = await makeTempRoot()
    await writeBundleFiles(
      root,
      'daan',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,s1,marked_space_park,,,',
        '',
      ].join('\n'),
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,daan,s1,marked_space_park,,,',
        '',
      ].join('\n'),
    )
    await writeBundleFiles(
      root,
      'zhongshan',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'zhongshan,s1,no_stop,,,',
        '',
      ].join('\n'),
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,zhongshan,s1,no_stop,,,',
        '',
      ].join('\n'),
    )

    const result = await runHumanReviewBundleIndex({
      reviewRoot: root,
      districtIds: ['zhongshan'],
      publishGateSummaryPath: null,
    })

    expect(result.entries.map((entry) => entry.districtId)).toEqual(['zhongshan'])
  })

  it('discovers a QA artifact when the handoff directory uses an area alias', async () => {
    const root = await makeTempRoot()
    const bundleDir = await writeBundleFiles(
      root,
      'beitou',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'beitou,s1,marked_space_park,,,',
        '',
      ].join('\n'),
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,beitou,s1,marked_space_park,,,',
        '',
      ].join('\n'),
    )
    const aliasDir = path.join(root, 'shipai-human-review')
    await fs.rename(bundleDir, aliasDir)

    const result = await runHumanReviewBundleIndex({
      reviewRoot: root,
      districtIds: ['shipai'],
      publishGateSummaryPath: null,
    })

    expect(result.hasErrors).toBe(false)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toMatchObject({
      bundleId: 'shipai',
      districtId: 'beitou',
      status: 'ready-for-review',
    })
    expect(result.entries[0]?.files.sourceCsv.path).toBe(path.join(aliasDir, 'beitou-review.csv'))
    expect(result.notReadyForFinalize).toEqual(['shipai'])
  })

  it('reports source-text review bundles through their specialized gate', async () => {
    const root = await makeTempRoot()
    const bundleDir = path.join(root, 'taoyuan-human-review')
    const reviewFileName = 'taoyuan-district-paid-curb-review.csv'
    await writeText(
      path.join(bundleDir, reviewFileName),
      ['parking_segment_id,source_text_review_status', 'segment-1,', ''].join('\n'),
    )
    await writeJson(path.join(bundleDir, 'taoyuan-district-paid-curb-review.manifest.json'), {
      schemaVersion: 1,
      districtId: 'taoyuan-district',
      reviewRecordCount: 1,
      allowedStatuses: ['APPROVED_SOURCE_TEXT', 'NEEDS_CORRECTION', 'UNCLEAR'],
      reviewCsv: reviewFileName,
    })
    await writeJson(path.join(bundleDir, 'status.json'), {
      districtId: 'taoyuan-district',
      structureValid: true,
      complete: false,
      approved: false,
      expectedRows: 1,
      actualRows: 1,
      statusCounts: { PENDING: 1 },
    })

    const result = await runHumanReviewBundleIndex({
      reviewRoot: root,
      publishGateSummaryPath: null,
    })
    const rendered = renderHumanReviewBundleIndex(result)

    expect(result.hasErrors).toBe(false)
    expect(result.entries).toEqual([])
    expect(result.specializedEntries).toEqual([
      expect.objectContaining({
        bundleId: 'taoyuan',
        districtId: 'taoyuan-district',
        contract: 'source-text',
        status: 'pending',
        expectedRows: 1,
        actualRows: 1,
        pendingRows: 1,
      }),
    ])
    expect(rendered).toContain('Specialized review bundles: 1')
    expect(rendered).toContain('ops:taoyuan-review-gate')
    expect(rendered).not.toContain('missing handoffCsv')
  })

  it('adds a publish WARN override only for baseline bootstrap warnings', async () => {
    const root = await makeTempRoot()
    const summaryPath = path.join(root, 'publish_gate_summary.json')
    await writeBundleFiles(
      root,
      'daan',
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,s1,marked_space_park,,,',
        '',
      ].join('\n'),
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,daan,s1,marked_space_park,,,',
        '',
      ].join('\n'),
    )
    await writeJson(summaryPath, {
      districts: [
        {
          districtId: 'daan',
          topWarnCodes: ['BASELINE_MISSING'],
        },
      ],
    })

    const result = await runHumanReviewBundleIndex({
      reviewRoot: root,
      configRoot: 'configs/expansion',
      publishGateSummaryPath: summaryPath,
    })

    expect(result.entries[0]?.publishGateWarnCodes).toEqual(['BASELINE_MISSING'])
    expect(result.entries[0]?.finalizeInputs).toMatchObject({
      districtId: 'daan',
      configPath: path.join('configs', 'expansion', 'daan.json'),
      answerCasesPath: path.join(
        'configs',
        'expansion',
        'daan.answer-cases.json',
      ),
      allowPublishWarn: true,
      publishOverrideReason: 'daan reviewed first-publish baseline bootstrap',
    })
    expect(result.entries[0]?.finalizeCommand.replace(/\\/g, '/')).toContain(
      '--answer-cases "configs/expansion/daan.answer-cases.json"',
    )
    expect(result.entries[0]?.finalizeCommand).toContain('--allow-publish-warn')
    expect(result.entries[0]?.finalizeCommand).toContain(
      '--publish-override "daan reviewed first-publish baseline bootstrap"',
    )
  })
})
