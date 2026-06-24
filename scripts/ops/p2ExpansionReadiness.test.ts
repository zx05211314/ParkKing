import { describe, expect, it, vi } from 'vitest'
import type { DistrictReadinessMatrixResult } from './districtReadinessMatrix'
import type { HumanReviewBundleIndexResult } from './humanReviewBundleIndex'
import type { P1ReleaseReadinessResult } from './p1ReleaseReadiness'
import {
  parseP2ExpansionReadinessArgs,
  renderP2ExpansionReadiness,
  runP2ExpansionReadiness,
  type P2ExpansionReadinessRunners,
} from './p2ExpansionReadiness'

const p1Pass = {
  pass: true,
} as unknown as P1ReleaseReadinessResult

const buildMatrix = (
  daanOverrides: Partial<
    DistrictReadinessMatrixResult['entries'][number]
  > = {},
): DistrictReadinessMatrixResult =>
  ({
    configGlob: 'configs/prod/*.json',
    publicRoot: 'public/data/generated',
    dryRunRoot: 'data/generated',
    reviewRoot: '.tmp',
    registryPath: 'public/data/generated/registry.json',
    registryFound: true,
    hasBlockers: true,
    entries: [
      {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        configPath: 'configs/prod/xinyi.json',
        runtimeStatus: 'published',
        dataPackStatus: 'available',
        primaryDatasetSource: 'public',
        datasetHash: 'xinyi-hash',
        generatedAt: '2026-05-10T00:00:00.000Z',
        counts: {
          segments: 10,
          parkingSpaces: 20,
          signOverrides: 7,
          inferredCandidates: 5,
        },
        reviewStatus: 'pass',
        reviewPath: '.tmp/xinyi-current-review.merged.csv',
        nextReviewPath: null,
        reviewedRows: 7,
        validReviewedRows: 7,
        pendingReviewRows: 0,
        publishGateStatus: 'pass',
        publishGateWarnCodes: [],
        publishGateFailCodes: [],
        blockers: [],
      },
      {
        districtId: 'daan',
        districtName: 'Daan',
        configPath: 'configs/prod/daan.json',
        runtimeStatus: 'stale-public-dir',
        dataPackStatus: 'available',
        primaryDatasetSource: 'dry-run',
        datasetHash: 'daan-hash',
        generatedAt: '2026-05-10T00:00:00.000Z',
        counts: {
          segments: 10,
          parkingSpaces: 39_257,
          signOverrides: 0,
          inferredCandidates: 1_846,
        },
        reviewStatus: 'blocked',
        reviewPath: '.tmp/daan-review.csv',
        nextReviewPath: '.tmp/daan-next-review.csv',
        reviewedRows: 0,
        validReviewedRows: 0,
        pendingReviewRows: 80,
        publishGateStatus: 'fail',
        publishGateWarnCodes: ['BASELINE_MISSING'],
        publishGateFailCodes: [
          'SIGN_OVERRIDE_COVERAGE_ZERO',
          'SIGN_OVERRIDE_INPUT_MISSING',
        ],
        blockers: [
          'runtime stale-public-dir',
          'sign overrides missing or zero',
          'review blocked',
          'publish gate fail: SIGN_OVERRIDE_COVERAGE_ZERO, SIGN_OVERRIDE_INPUT_MISSING',
          'publish gate warn: BASELINE_MISSING',
        ],
        ...daanOverrides,
      },
    ],
  }) as DistrictReadinessMatrixResult

const buildReviewIndex = (
  status: 'ready-for-review' | 'ready-to-finalize' | 'incomplete' = 'ready-for-review',
): HumanReviewBundleIndexResult =>
  ({
    reviewRoot: '.tmp',
    publishGateSummaryPath: 'data/generated/_ops/publish_gate_summary.json',
    finalizeReadyCount: status === 'ready-to-finalize' ? 1 : 0,
    notReadyForFinalize: status === 'ready-to-finalize' ? [] : ['daan'],
    hasWarnings: false,
    hasErrors: false,
    warnings: [],
    errors: [],
    entries: [
      {
        districtId: 'daan',
        bundleDir: '.tmp/daan-human-review',
        bundleId: 'daan',
        sourcePath: '.tmp/daan-review.csv',
        status,
        publishGateWarnCodes: ['BASELINE_MISSING'],
        files: {
          handoffCsv: {
            path: '.tmp/daan-human-review/daan-next-review.csv',
            exists: true,
            bytes: 100,
          },
        },
        handoffRows: 10,
        handoffReviewedRows: status === 'ready-to-finalize' ? 4 : 0,
        handoffValidReviewedRows: status === 'ready-to-finalize' ? 4 : 0,
        handoffPendingRows: status === 'ready-to-finalize' ? 6 : 10,
        handoffEstimatedMinimumNewReviews:
          status === 'ready-to-finalize' ? 0 : 4,
        totalRows: 80,
        reviewedRows: 0,
        validReviewedRows: 0,
        pendingRows: 80,
        estimatedMinimumNewReviews: 4,
        missingStatuses: ['LEGAL', 'ILLEGAL'],
        missingBuckets: ['marked_space_park'],
        bucketMinimumsRemaining: {
          marked_space_park: 2,
          no_stop: 2,
        },
        finalizeInputs: {
          districtId: 'daan',
          sourcePath: '.tmp/daan-review.csv',
          reviewsPath: '.tmp/daan-human-review/daan-next-review.csv',
          mergedOutPath: '.tmp/daan-review.merged.csv',
          configPath: 'configs/prod/daan.json',
          allowPublishWarn: true,
          publishOverrideReason: 'daan reviewed first-publish baseline bootstrap',
        },
        finalizeCommand: 'npm run ops:p0-finalize-review -- --district daan',
        warnings: [],
        errors: [],
      },
    ],
  }) as HumanReviewBundleIndexResult

const buildRunners = (
  overrides: Partial<P2ExpansionReadinessRunners> = {},
): P2ExpansionReadinessRunners => ({
  runP1ReleaseReadiness: vi.fn().mockResolvedValue(p1Pass),
  runDistrictReadinessMatrix: vi.fn().mockResolvedValue(buildMatrix()),
  runHumanReviewBundleIndex: vi.fn().mockResolvedValue(buildReviewIndex()),
  ...overrides,
})

describe('p2ExpansionReadiness', () => {
  it('parses P2 expansion readiness options', () => {
    expect(
      parseP2ExpansionReadinessArgs([
        'node',
        'p2ExpansionReadiness',
        '--current-district',
        'xinyi',
        '--expansion-district',
        'daan,zhongshan',
        '--root',
        'public/data/generated',
        '--dry-run-root',
        'data/generated',
        '--registry',
        'public/data/generated/registry.json',
        '--configs',
        'configs/prod/*.json',
        '--review-root',
        '.tmp',
        '--publish-gate-summary',
        'data/generated/_ops/publish_gate_summary.json',
        '--timeout-ms',
        '25000',
        '--out',
        '.tmp/p2.md',
        '--json-out',
        '.tmp/p2.json',
        '--skip-p1',
        '--require-ready-to-finalize',
        '--json',
      ]),
    ).toMatchObject({
      currentDistrictId: 'xinyi',
      expansionDistrictIds: ['daan', 'zhongshan'],
      root: 'public/data/generated',
      dryRunRoot: 'data/generated',
      registryPath: 'public/data/generated/registry.json',
      configGlob: 'configs/prod/*.json',
      reviewRoot: '.tmp',
      publishGateSummaryPath: 'data/generated/_ops/publish_gate_summary.json',
      timeoutMs: 25000,
      outPath: '.tmp/p2.md',
      jsonOutPath: '.tmp/p2.json',
      skipP1: true,
      requireReadyToFinalize: true,
      json: true,
    })
  })

  it('passes automation readiness while marking pending human review', async () => {
    const result = await runP2ExpansionReadiness(
      { expansionDistrictIds: ['daan'] },
      buildRunners(),
    )

    expect(result.pass).toBe(true)
    expect(result.status).toBe('HUMAN_REVIEW_REQUIRED')
    expect(result.expansionDistricts[0]).toMatchObject({
      districtId: 'daan',
      nextAction: 'fill-human-review',
      automationBlockers: [],
    })
    expect(renderP2ExpansionReadiness(result)).toContain(
      '# P2 Expansion Readiness: HUMAN_REVIEW_REQUIRED',
    )
    expect(renderP2ExpansionReadiness(result)).toContain('## Human Review Required')
    expect(renderP2ExpansionReadiness(result)).toContain('## Automation Blockers')
    expect(renderP2ExpansionReadiness(result)).toContain(
      'fill reviewStatus/reviewNote/createdAt in the handoff CSV',
    )
  })

  it('treats candidate-only ready handoffs as human review required when P1 is skipped', async () => {
    const matrix = buildMatrix({
      runtimeStatus: 'not-published',
      reviewStatus: 'missing',
      blockers: [
        'runtime not-published',
        'sign overrides missing or zero',
        'review missing',
        'publish gate fail: SIGN_OVERRIDE_COVERAGE_ZERO, SIGN_OVERRIDE_INPUT_MISSING',
        'publish gate warn: BASELINE_MISSING',
      ],
    })
    matrix.entries = matrix.entries.filter((entry) => entry.districtId === 'daan')

    const result = await runP2ExpansionReadiness(
      {
        expansionDistrictIds: ['daan'],
        configGlob: 'configs/expansion/*.json',
        skipP1: true,
      },
      buildRunners({
        runDistrictReadinessMatrix: vi.fn().mockResolvedValue(matrix),
      }),
    )

    expect(result.pass).toBe(true)
    expect(result.status).toBe('HUMAN_REVIEW_REQUIRED')
    expect(result.blockers).toEqual([])
    expect(result.expansionDistricts[0]).toMatchObject({
      districtId: 'daan',
      reviewStatus: 'missing',
      reviewBundleStatus: 'ready-for-review',
      nextAction: 'fill-human-review',
      automationBlockers: [],
    })
  })

  it('does not disable publish gate summary when the flag is omitted', () => {
    expect(
      parseP2ExpansionReadinessArgs(['node', 'p2ExpansionReadiness']),
    ).toHaveProperty('publishGateSummaryPath', undefined)
    expect(
      parseP2ExpansionReadinessArgs([
        'node',
        'p2ExpansionReadiness',
        '--no-publish-gate-summary',
      ]),
    ).toHaveProperty('publishGateSummaryPath', null)
  })

  it('marks a reviewed expansion district ready to finalize', async () => {
    const result = await runP2ExpansionReadiness(
      {
        expansionDistrictIds: ['daan'],
        skipP1: true,
        requireReadyToFinalize: true,
      },
      buildRunners({
        runHumanReviewBundleIndex: vi
          .fn()
          .mockResolvedValue(buildReviewIndex('ready-to-finalize')),
      }),
    )

    expect(result.pass).toBe(true)
    expect(result.status).toBe('READY_TO_FINALIZE')
    expect(result.p1Release).toBeNull()
    expect(result.expansionDistricts[0]?.nextAction).toBe('finalize-review')
  })

  it('marks a published reviewed expansion district as expansion ready', async () => {
    const result = await runP2ExpansionReadiness(
      {
        expansionDistrictIds: ['daan'],
        skipP1: true,
        requireReadyToFinalize: true,
      },
      buildRunners({
        runDistrictReadinessMatrix: vi.fn().mockResolvedValue(
          buildMatrix({
            runtimeStatus: 'published',
            primaryDatasetSource: 'public',
            counts: {
              segments: 10,
              parkingSpaces: 39_257,
              signOverrides: 10,
              inferredCandidates: 1_846,
            },
            reviewStatus: 'pass',
            reviewedRows: 10,
            validReviewedRows: 10,
            pendingReviewRows: 70,
            blockers: [
              'publish gate fail: SIGN_OVERRIDE_COVERAGE_ZERO, SIGN_OVERRIDE_INPUT_MISSING',
              'publish gate warn: BASELINE_MISSING',
            ],
          }),
        ),
        runHumanReviewBundleIndex: vi
          .fn()
          .mockResolvedValue(buildReviewIndex('ready-to-finalize')),
      }),
    )

    expect(result.pass).toBe(true)
    expect(result.status).toBe('EXPANSION_READY')
    expect(result.expansionDistricts[0]?.nextAction).toBe('published')
    expect(renderP2ExpansionReadiness(result)).toContain('published')
    expect(renderP2ExpansionReadiness(result)).toContain(
      '## Recommended Next Commands',
    )
    expect(renderP2ExpansionReadiness(result)).toContain('- none')
  })

  it('blocks strict expansion readiness until human review can finalize', async () => {
    const result = await runP2ExpansionReadiness(
      {
        expansionDistrictIds: ['daan'],
        requireReadyToFinalize: true,
      },
      buildRunners(),
    )

    expect(result.pass).toBe(false)
    expect(result.status).toBe('BLOCKED')
    expect(result.expansionDistricts[0]).toMatchObject({
      districtId: 'daan',
      nextAction: 'fill-human-review',
      automationBlockers: [],
    })
    expect(result.blockers).toContain(
      'expansion districts not ready to finalize: daan',
    )
  })

  it('blocks unexpected expansion data gaps', async () => {
    const result = await runP2ExpansionReadiness(
      { expansionDistrictIds: ['daan'] },
      buildRunners({
        runDistrictReadinessMatrix: vi.fn().mockResolvedValue(
          buildMatrix({
            counts: {
              segments: 10,
              parkingSpaces: 0,
              signOverrides: 0,
              inferredCandidates: 1_846,
            },
            blockers: [
              'parking spaces missing or zero',
              'sign overrides missing or zero',
            ],
          }),
        ),
      }),
    )

    expect(result.pass).toBe(false)
    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain(
      'daan: parking spaces missing or zero',
    )
    expect(result.blockers).toContain(
      'daan: parking space evidence missing or zero',
    )
  })
})
