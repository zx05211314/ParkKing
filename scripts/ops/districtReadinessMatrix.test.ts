import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseDistrictReadinessMatrixArgs,
  renderDistrictReadinessMatrix,
  resolveDistrictReadinessMatrixSummaryPath,
  runDistrictReadinessMatrix,
} from './districtReadinessMatrix'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'district-readiness-matrix-'))

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const writeJson = async (targetPath: string, payload: unknown) => {
  await writeText(targetPath, `${JSON.stringify(payload, null, 2)}\n`)
}

const writeConfig = async (root: string, districtId: string) => {
  const configPath = path.join(root, 'configs', 'prod', `${districtId}.json`)
  await writeJson(configPath, {
    districtId,
    districtName: districtId.toUpperCase(),
    inputs: {
      districtBounds: 'district_bounds.geojson',
      redYellow: 'red_yellow.geojson',
      busStops: 'bus_stops.geojson',
      hydrants: 'hydrants.geojson',
    },
  })
  return configPath
}

const writeMeta = async (
  root: string,
  districtId: string,
  counts: {
    parkingSpaces: number
    signOverrides: number
    inferredCandidates: number
  },
) => {
  await writeJson(path.join(root, districtId, 'dataset_meta.json'), {
    districtId,
    districtName: districtId.toUpperCase(),
    datasetHash: `${districtId}-hash`,
    generatedAt: '2026-05-10T00:00:00.000Z',
    counts: {
      segments: 10,
      parkingSpaces: counts.parkingSpaces,
      signOverrides: counts.signOverrides,
      inferredCandidates: counts.inferredCandidates,
    },
  })
}

describe('districtReadinessMatrix', () => {
  it('parses matrix options', () => {
    expect(
      parseDistrictReadinessMatrixArgs([
        'node',
        'districtReadinessMatrix',
        '--configs',
        'configs/prod/*.json',
        '--public-root',
        'public/data/generated',
        '--dry-run-root',
        'data/generated',
        '--review-root',
        '.tmp',
        '--answer-cases-glob',
        'configs/prod/*.answer-cases.json',
        '--allow-answer-case-review-fallback',
        '--registry',
        'public/data/generated/registry.json',
        '--summary',
        '.tmp/summary.md',
        '--json',
      ]),
    ).toEqual({
      configGlob: 'configs/prod/*.json',
      publicRoot: 'public/data/generated',
      dryRunRoot: 'data/generated',
      reviewRoot: '.tmp',
      answerCasesGlob: 'configs/prod/*.answer-cases.json',
      allowAnswerCaseReviewFallback: true,
      registryPath: 'public/data/generated/registry.json',
      summaryPath: '.tmp/summary.md',
      json: true,
    })
  })

  it('uses GITHUB_STEP_SUMMARY when no explicit summary is passed', () => {
    expect(
      resolveDistrictReadinessMatrixSummaryPath(
        {},
        { GITHUB_STEP_SUMMARY: '.tmp/workflow-summary.md' },
      ),
    ).toBe('.tmp/workflow-summary.md')
  })

  it('builds a readiness matrix across published and unpublished districts', async () => {
    const root = await makeTempRoot()
    const publicRoot = path.join(root, 'public', 'data', 'generated')
    const dryRunRoot = path.join(root, 'data', 'generated')
    const reviewRoot = path.join(root, '.tmp')
    await writeConfig(root, 'xinyi')
    await writeConfig(root, 'daan')
    await writeMeta(publicRoot, 'xinyi', {
      parkingSpaces: 3,
      signOverrides: 2,
      inferredCandidates: 4,
    })
    await writeMeta(publicRoot, 'daan', {
      parkingSpaces: 0,
      signOverrides: 0,
      inferredCandidates: 0,
    })
    await writeMeta(dryRunRoot, 'daan', {
      parkingSpaces: 5,
      signOverrides: 0,
      inferredCandidates: 6,
    })
    await writeJson(path.join(publicRoot, 'registry.json'), {
      districts: [{ districtId: 'xinyi' }],
    })
    await writeJson(path.join(publicRoot, '_ops', 'publish_gate_summary.json'), {
      baselineAdopt: {
        enabled: true,
        applied: true,
        districtIds: ['xinyi'],
        reason: 'baseline_adopt',
      },
      districts: [
        {
          districtId: 'xinyi',
          warn: 1,
          fail: 0,
          topWarnCodes: ['TIER_DELTA'],
          topFailCodes: [],
        },
      ],
    })
    await writeJson(path.join(dryRunRoot, '_ops', 'publish_gate_summary.json'), {
      districts: [
        {
          districtId: 'xinyi',
          warn: 0,
          fail: 1,
          topFailCodes: ['STALE_DRY_RUN_SHOULD_NOT_OVERRIDE_PUBLIC'],
        },
        {
          districtId: 'daan',
          warn: 1,
          fail: 2,
          topWarnCodes: ['BASELINE_MISSING'],
          topFailCodes: ['SIGN_OVERRIDE_INPUT_MISSING'],
        },
      ],
    })
    await writeText(
      path.join(reviewRoot, 'xinyi-current-review.merged.csv'),
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,s1,marked_space_park,LEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s2,marked_space_park,ILLEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s3,no_stop,LEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s4,no_stop,ILLEGAL,observed,2026-05-10T00:00:00.000Z',
        '',
      ].join('\n'),
    )
    await writeText(
      path.join(reviewRoot, 'daan-review.csv'),
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,s1,marked_space_park,,,',
        'daan,s2,no_stop,,,',
        '',
      ].join('\n'),
    )
    await writeText(path.join(reviewRoot, 'daan-next-review.csv'), 'pending\n')

    const result = await runDistrictReadinessMatrix({
      configGlob: path.join(root, 'configs', 'prod', '*.json'),
      publicRoot,
      dryRunRoot,
      reviewRoot,
    })
    const xinyi = result.entries.find((entry) => entry.districtId === 'xinyi')
    const daan = result.entries.find((entry) => entry.districtId === 'daan')

    expect(xinyi).toMatchObject({
      runtimeStatus: 'published',
      reviewStatus: 'pass',
      publishGateStatus: 'pass',
      blockers: [],
    })
    expect(daan).toMatchObject({
      runtimeStatus: 'stale-public-dir',
      dataPackStatus: 'available',
      primaryDatasetSource: 'dry-run',
      reviewStatus: 'blocked',
      publishGateStatus: 'fail',
    })
    expect(daan?.blockers).toContain('sign overrides missing or zero')
    expect(daan?.blockers).toContain(
      'publish gate fail: SIGN_OVERRIDE_INPUT_MISSING',
    )
    expect(daan?.blockers).toContain('publish gate warn: BASELINE_MISSING')
    expect(renderDistrictReadinessMatrix(result)).toContain(
      'District readiness matrix: WARN',
    )
  })

  it('can use committed answer cases as a tag-release review fallback', async () => {
    const root = await makeTempRoot()
    const publicRoot = path.join(root, 'public', 'data', 'generated')
    const reviewRoot = path.join(root, 'empty-review-root')
    const answerCasesGlob = path
      .join(root, 'configs', 'prod', '*.answer-cases.json')
      .replace(/\\/g, '/')
    await writeConfig(root, 'xinyi')
    await writeMeta(publicRoot, 'xinyi', {
      parkingSpaces: 3,
      signOverrides: 2,
      inferredCandidates: 4,
    })
    await writeJson(path.join(publicRoot, 'registry.json'), {
      districts: [{ districtId: 'xinyi' }],
    })
    const casesPath = path.join(root, 'configs', 'prod', 'xinyi.answer-cases.json')
    await writeJson(casesPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      datasetHash: 'stale-reviewed-hash',
      cases: [
        {
          id: 'case-1',
          lng: 121.56,
          lat: 25.03,
          expectedKind: 'PARK',
        },
      ],
    })

    const strict = await runDistrictReadinessMatrix({
      configGlob: path.join(root, 'configs', 'prod', '*.json'),
      publicRoot,
      reviewRoot,
      answerCasesGlob,
    })
    expect(strict.entries[0]).toMatchObject({
      reviewStatus: 'missing',
      blockers: ['review missing'],
    })

    const fallback = await runDistrictReadinessMatrix({
      configGlob: path.join(root, 'configs', 'prod', '*.json'),
      publicRoot,
      reviewRoot,
      answerCasesGlob,
      allowAnswerCaseReviewFallback: true,
    })

    expect(fallback.entries[0]).toMatchObject({
      reviewStatus: 'pass',
      reviewedRows: 1,
      validReviewedRows: 1,
      pendingReviewRows: 0,
      blockers: [],
    })
    expect(fallback.entries[0]?.reviewPath?.replace(/\\/g, '/')).toBe(
      path.resolve(casesPath).replace(/\\/g, '/'),
    )
  })

  it('does not block publish warnings that passed with an explicit override', async () => {
    const root = await makeTempRoot()
    const publicRoot = path.join(root, 'public', 'data', 'generated')
    const reviewRoot = path.join(root, '.tmp')
    await writeConfig(root, 'xinyi')
    await writeMeta(publicRoot, 'xinyi', {
      parkingSpaces: 3,
      signOverrides: 2,
      inferredCandidates: 4,
    })
    await writeJson(path.join(publicRoot, 'registry.json'), {
      districts: [{ districtId: 'xinyi' }],
    })
    await writeJson(path.join(publicRoot, '_ops', 'publish_gate_summary.json'), {
      allowWarn: true,
      overrideReason: 'tag release approved by reviewed gates',
      exitCode: 0,
      baselineAdopt: {
        enabled: false,
        applied: false,
        districtIds: [],
        reason: null,
      },
      districts: [
        {
          districtId: 'xinyi',
          warn: 1,
          fail: 0,
          topWarnCodes: ['PERF_REGRESSION'],
          topFailCodes: [],
        },
      ],
    })
    await writeText(
      path.join(reviewRoot, 'xinyi-current-review.merged.csv'),
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,s1,marked_space_park,LEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s2,marked_space_park,ILLEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s3,no_stop,LEGAL,observed,2026-05-10T00:00:00.000Z',
        'xinyi,s4,no_stop,ILLEGAL,observed,2026-05-10T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runDistrictReadinessMatrix({
      configGlob: path.join(root, 'configs', 'prod', '*.json'),
      publicRoot,
      reviewRoot,
    })

    expect(result.entries[0]).toMatchObject({
      publishGateStatus: 'pass',
      publishGateWarnCodes: ['PERF_REGRESSION'],
      publishGateWarnAllowed: true,
      blockers: [],
    })
    expect(renderDistrictReadinessMatrix(result)).toContain(
      'warn PERF_REGRESSION (allowed); fail none',
    )
  })
})
