import { describe, expect, it, vi } from 'vitest'
import type { P0AdvanceReviewsResult } from './p0AdvanceReviews'
import type { P2ExpansionReadinessResult } from './p2ExpansionReadiness'
import {
  parseP2StatusArgs,
  renderP2Status,
  runP2Status,
  type P2ReviewPackageArtifact,
  type P2StatusRunners,
} from './p2Status'

const expansionDistrict = (
  districtId: string,
  nextAction:
    | 'fill-human-review'
    | 'finalize-review'
    | 'already-reviewed'
    | 'published',
) => ({
  districtId,
  runtimeStatus: nextAction === 'published' ? 'published' : 'stale-public-dir',
  dataPackStatus: 'available',
  parkingSpaces: 100,
  inferredCandidates: 10,
  signOverrides: nextAction === 'published' ? 10 : 0,
  reviewStatus: nextAction === 'published' ? 'pass' : 'blocked',
  publishGateStatus: 'fail',
  matrixBlockers: [],
  reviewBundleStatus:
    nextAction === 'fill-human-review' ? 'ready-for-review' : 'ready-to-finalize',
  handoffRows: 10,
  handoffValidReviewedRows: nextAction === 'fill-human-review' ? 0 : 4,
  sourceValidReviewedRows: 0,
  automationBlockers: [],
  nextAction,
})

const readiness = (
  overrides: Partial<P2ExpansionReadinessResult> = {},
): P2ExpansionReadinessResult =>
  ({
    pass: true,
    status: 'HUMAN_REVIEW_REQUIRED',
    inputs: {
      currentDistrictId: 'xinyi',
      expansionDistrictIds: ['daan', 'zhongshan'],
      root: 'public/data/generated',
      dryRunRoot: 'data/generated',
      registryPath: 'public/data/generated/registry.json',
      configGlob: 'configs/prod/*.json',
      reviewRoot: '.tmp',
      publishGateSummaryPath: 'data/generated/_ops/publish_gate_summary.json',
      skipP1: false,
      requireReadyToFinalize: false,
      timeoutMs: 25_000,
    },
    p1Release: { pass: true },
    districtMatrix: { entries: [] },
    reviewIndex: { entries: [], warnings: [], errors: [] },
    currentDistrict: null,
    expansionDistricts: [
      expansionDistrict('daan', 'fill-human-review'),
      expansionDistrict('zhongshan', 'fill-human-review'),
    ],
    blockers: [],
    warnings: [],
    ...overrides,
  }) as unknown as P2ExpansionReadinessResult

const reviewGate = (
  overrides: Partial<P0AdvanceReviewsResult> = {},
): P0AdvanceReviewsResult =>
  ({
    pass: false,
    status: 'blocked',
    mode: 'dry-run',
    reviewRoot: '.tmp',
    outDir: '.tmp/human-review-packages',
    selectedDistricts: ['daan', 'zhongshan'],
    entries: [
      {
        districtId: 'daan',
        status: 'ready-for-review',
        nextAction: 'package-human-review',
      },
      {
        districtId: 'zhongshan',
        status: 'ready-for-review',
        nextAction: 'package-human-review',
      },
    ],
    index: {
      reviewRoot: '.tmp',
      publishGateSummaryPath: 'data/generated/_ops/publish_gate_summary.json',
      entries: [],
      finalizeReadyCount: 0,
      notReadyForFinalize: ['daan', 'zhongshan'],
      warnings: [],
      errors: [],
      hasWarnings: false,
      hasErrors: false,
    },
    reviewIntakeResult: null,
    auditResult: null,
    packageResult: null,
    finalizeResult: null,
    intakeFinalizeResults: [],
    errors: [
      'Require-ready-to-finalize failed; not ready for finalize: daan, zhongshan',
    ],
    warnings: [],
    ...overrides,
  }) as unknown as P0AdvanceReviewsResult

const runners = (params: {
  loose?: P2ExpansionReadinessResult
  strict?: P2ExpansionReadinessResult
  gate?: P0AdvanceReviewsResult
  packages?: P2ReviewPackageArtifact[]
} = {}): P2StatusRunners => {
  const loose = params.loose ?? readiness()
  const strict =
    params.strict ??
    readiness({
      pass: false,
      status: 'BLOCKED',
      blockers: ['expansion districts not ready to finalize: daan, zhongshan'],
      inputs: {
        ...loose.inputs,
        requireReadyToFinalize: true,
      },
    })
  return {
    runP2ExpansionReadiness: vi
      .fn()
      .mockResolvedValueOnce(loose)
      .mockResolvedValueOnce(strict),
    runP0AdvanceReviews: vi.fn().mockResolvedValue(params.gate ?? reviewGate()),
    findLatestReviewPackages: vi.fn().mockResolvedValue(params.packages ?? []),
  }
}

describe('p2Status', () => {
  it('parses P2 status options', () => {
    expect(
      parseP2StatusArgs([
        'node',
        'p2Status',
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
        '.tmp/p2-status.md',
        '--json-out',
        '.tmp/p2-status.json',
        '--skip-p1',
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
      timeoutMs: 25_000,
      outPath: '.tmp/p2-status.md',
      jsonOutPath: '.tmp/p2-status.json',
      skipP1: true,
      json: true,
    })
  })

  it('does not disable publish gate summary when the flag is omitted', () => {
    expect(
      parseP2StatusArgs(['node', 'p2Status']),
    ).not.toHaveProperty('publishGateSummaryPath', null)
    expect(parseP2StatusArgs(['node', 'p2Status'])).toHaveProperty(
      'publishGateSummaryPath',
      undefined,
    )
    expect(
      parseP2StatusArgs(['node', 'p2Status', '--no-publish-gate-summary']),
    ).toHaveProperty('publishGateSummaryPath', null)
  })

  it('treats pending human review as reportable but not an automation blocker', async () => {
    const result = await runP2Status(
      {},
      runners({
        packages: [
          {
            districtId: 'daan',
            zipPath: '.tmp/human-review-packages/daan-human-review-latest.zip',
            bytes: 123,
            modifiedAt: '2026-05-23T05:00:00.000Z',
          },
        ],
      }),
    )

    expect(result.pass).toBe(true)
    expect(result.status).toBe('HUMAN_REVIEW_REQUIRED')
    expect(result.readyToFinalize).toBe(false)
    expect(result.pendingHumanReviewDistricts).toEqual(['daan', 'zhongshan'])
    expect(result.latestReviewPackages).toMatchObject([
      {
        districtId: 'daan',
        zipPath: '.tmp/human-review-packages/daan-human-review-latest.zip',
      },
    ])
    expect(result.blockers).toEqual([])
    expect(renderP2Status(result)).toContain('# P2 Status: HUMAN_REVIEW_REQUIRED')
    expect(renderP2Status(result)).toContain('## Human Review Required')
    expect(renderP2Status(result)).toContain('## Latest Review Packages')
    expect(renderP2Status(result)).toContain(
      '.tmp/human-review-packages/daan-human-review-latest.zip',
    )
    expect(renderP2Status(result)).toContain(
      'zhongshan: none found; run `npm run ops:p2-human-review-handoff`',
    )
    expect(renderP2Status(result)).toContain('## Automation Blockers')
    expect(renderP2Status(result)).toContain('npm run ops:p2-human-review-handoff')
    expect(renderP2Status(result)).toContain('npm run ops:p2-review-diagnostics')
  })

  it('blocks unexpected review gate errors', async () => {
    const result = await runP2Status(
      {},
      runners({
        gate: reviewGate({
          errors: ['Review root missing: .tmp'],
        }),
      }),
    )

    expect(result.pass).toBe(false)
    expect(result.status).toBe('BLOCKED')
    expect(result.blockers).toContain('review gate: Review root missing: .tmp')
  })

  it('marks P2 ready to finalize when strict readiness and review gate pass', async () => {
    const readyDistricts = [
      expansionDistrict('daan', 'finalize-review'),
      expansionDistrict('zhongshan', 'finalize-review'),
    ]
    const result = await runP2Status(
      {},
      runners({
        loose: readiness({
          status: 'READY_TO_FINALIZE',
          expansionDistricts: readyDistricts,
        }),
        strict: readiness({
          status: 'READY_TO_FINALIZE',
          expansionDistricts: readyDistricts,
        }),
        gate: reviewGate({
          pass: true,
          status: 'ready-to-finalize',
          errors: [],
          finalizeResult: {
            pass: true,
            mode: 'dry-run',
            reviewRoot: '.tmp',
            selectedDistricts: ['daan', 'zhongshan'],
            ready: [
              {
                districtId: 'daan',
                status: 'ready-to-finalize',
                command: 'finalize daan',
                inputs: {
                  districtId: 'daan',
                  sourcePath: '.tmp/daan-review.csv',
                  reviewsPath: '.tmp/daan-human-review/daan-next-review.csv',
                  mergedOutPath: '.tmp/daan-review.merged.csv',
                  configPath: 'configs/prod/daan.json',
                  allowPublishWarn: true,
                  publishOverrideReason: 'daan bootstrap',
                },
                result: null,
              },
              {
                districtId: 'zhongshan',
                status: 'ready-to-finalize',
                command: 'finalize zhongshan',
                inputs: {
                  districtId: 'zhongshan',
                  sourcePath: '.tmp/zhongshan-review.csv',
                  reviewsPath:
                    '.tmp/zhongshan-human-review/zhongshan-next-review.csv',
                  mergedOutPath: '.tmp/zhongshan-review.merged.csv',
                  configPath: 'configs/prod/zhongshan.json',
                  allowPublishWarn: true,
                  publishOverrideReason: 'zhongshan bootstrap',
                },
                result: null,
              },
            ],
            skipped: [],
            errors: [],
            warnings: [],
          },
        }),
      }),
    )

    expect(result.pass).toBe(true)
    expect(result.status).toBe('READY_TO_FINALIZE')
    expect(result.readyToFinalize).toBe(true)
    expect(result.readyFinalizeDistricts).toEqual(['daan', 'zhongshan'])
    expect(renderP2Status(result)).toContain('finalize daan')
    expect(renderP2Status(result)).toContain('finalize zhongshan')
    expect(renderP2Status(result)).toContain('npm run ops:p2-finalize-ready:execute')
  })

  it('marks P2 expansion ready when reviewed districts are already published', async () => {
    const publishedDistricts = [
      expansionDistrict('daan', 'published'),
      expansionDistrict('zhongshan', 'published'),
    ]
    const result = await runP2Status(
      {},
      runners({
        loose: readiness({
          status: 'EXPANSION_READY',
          expansionDistricts: publishedDistricts,
        }),
        strict: readiness({
          status: 'EXPANSION_READY',
          expansionDistricts: publishedDistricts,
        }),
        gate: reviewGate({
          pass: true,
          status: 'ready-to-finalize',
          errors: [],
          finalizeResult: {
            pass: true,
            mode: 'dry-run',
            reviewRoot: '.tmp',
            selectedDistricts: ['daan', 'zhongshan'],
            ready: [
              {
                districtId: 'daan',
                status: 'ready-to-finalize',
                command: 'finalize daan',
                inputs: {
                  districtId: 'daan',
                  sourcePath: '.tmp/daan-review.csv',
                  reviewsPath: '.tmp/daan-human-review/daan-next-review.csv',
                  mergedOutPath: '.tmp/daan-review.merged.csv',
                  configPath: 'configs/prod/daan.json',
                  allowPublishWarn: true,
                  publishOverrideReason: 'daan bootstrap',
                },
                result: null,
              },
              {
                districtId: 'zhongshan',
                status: 'ready-to-finalize',
                command: 'finalize zhongshan',
                inputs: {
                  districtId: 'zhongshan',
                  sourcePath: '.tmp/zhongshan-review.csv',
                  reviewsPath:
                    '.tmp/zhongshan-human-review/zhongshan-next-review.csv',
                  mergedOutPath: '.tmp/zhongshan-review.merged.csv',
                  configPath: 'configs/prod/zhongshan.json',
                  allowPublishWarn: true,
                  publishOverrideReason: 'zhongshan bootstrap',
                },
                result: null,
              },
            ],
            skipped: [],
            errors: [],
            warnings: [],
          },
        }),
      }),
    )

    expect(result.pass).toBe(true)
    expect(result.status).toBe('EXPANSION_READY')
    expect(result.readyToFinalize).toBe(false)
    expect(result.readyFinalizeDistricts).toEqual([])
    expect(result.finalizedDistricts).toEqual(['daan', 'zhongshan'])
    expect(renderP2Status(result)).toContain('Finalized districts: daan, zhongshan')
    expect(renderP2Status(result)).toContain(
      'none; expansion districts are published',
    )
    expect(renderP2Status(result)).not.toContain('finalize daan')
    expect(renderP2Status(result)).not.toContain('npm run ops:p2-finalize-ready:execute')
  })
})
