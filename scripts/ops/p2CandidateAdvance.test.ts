import * as path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { P0AdvanceReviewsResult } from './p0AdvanceReviews'
import {
  canCreateMissingReviewHandoff,
  classifyP2CandidateStage,
  parseP2CandidateAdvanceArgs,
  resolveCandidateReviewPaths,
  resolveP2CandidateAdvanceInputs,
  runP2CandidateAdvance,
  type P2CandidateAdvanceRunners,
} from './p2CandidateAdvance'
import type { P2PromoteExpansionResult } from './p2PromoteExpansion'
import type { P2StatusResult } from './p2Status'

const statusResult = (params: {
  nextAction: string
  status?: P2StatusResult['status']
  pending?: boolean
  ready?: boolean
  packaged?: boolean
  missingBundle?: boolean
  pass?: boolean
}): P2StatusResult =>
  ({
    pass: params.pass ?? true,
    status:
      params.status ??
      (params.pending ? 'HUMAN_REVIEW_REQUIRED' : 'EXPANSION_READY'),
    readyToFinalize: Boolean(params.ready),
    inputs: {},
    readiness: {
      expansionDistricts: [
        {
          districtId: 'songshan',
          nextAction: params.nextAction,
          dataPackStatus: 'available',
          reviewBundleStatus: params.missingBundle ? 'missing' : 'ready-for-review',
          automationBlockers: params.missingBundle
            ? ['human review bundle missing']
            : [],
        },
      ],
    },
    strictReadiness: {},
    reviewGate: {},
    blockers: params.pass === false ? ['automation blocker'] : [],
    pendingHumanReviewDistricts: params.pending ? ['songshan'] : [],
    readyFinalizeDistricts: params.ready ? ['songshan'] : [],
    finalizedDistricts:
      params.nextAction === 'published' ? ['songshan'] : [],
    latestReviewPackages: params.packaged
      ? [
          {
            districtId: 'songshan',
            zipPath: '.tmp/songshan.zip',
            bytes: 1,
            modifiedAt: '2026-07-15T00:00:00.000Z',
          },
        ]
      : [],
    warnings: [],
  }) as P2StatusResult

const advanceResult = (pass = true): P0AdvanceReviewsResult =>
  ({
    pass,
    errors: pass ? [] : ['advance failed'],
    warnings: [],
  }) as P0AdvanceReviewsResult

const promotionResult = (pass = true): P2PromoteExpansionResult =>
  ({
    pass,
    errors: pass ? [] : ['promotion failed'],
    warnings: [],
    followUpCommands: ['npm run ingest:all -- --configs configs/prod/songshan.json'],
  }) as P2PromoteExpansionResult

const preparationResult = () => ({
  pass: true,
  bundleDir: '.tmp/songshan-human-review',
  sourcePath: '.tmp/songshan-human-review/songshan-review.csv',
  handoffPath: '.tmp/songshan-human-review/songshan-next-review.csv',
  sampled: true,
  prepared: true,
  errors: [],
  warnings: [],
})

const runners = (
  statuses: P2StatusResult[],
): P2CandidateAdvanceRunners => ({
  runStatus: vi.fn().mockImplementation(async () => {
    const next = statuses.shift()
    if (!next) {
      throw new Error('unexpected status call')
    }
    return next
  }),
  runAdvanceReviews: vi.fn().mockResolvedValue(advanceResult()),
  prepareReview: vi.fn().mockResolvedValue(preparationResult()),
  runPromotion: vi.fn().mockResolvedValue(promotionResult()),
})

describe('p2CandidateAdvance', () => {
  it('parses execution flags and derives the mixed candidate config scope', () => {
    const options = parseP2CandidateAdvanceArgs([
      'node',
      'p2CandidateAdvance',
      '--district',
      'Songshan',
      '--execute',
      '--overwrite',
    ])
    const inputs = resolveP2CandidateAdvanceInputs(options)

    expect(inputs).toMatchObject({
      districtId: 'songshan',
      currentDistrictId: 'xinyi',
      configRoot: 'configs/expansion',
      prodConfigRoot: 'configs/prod',
      configGlob: 'configs/prod/xinyi.json,configs/expansion/songshan.json',
      execute: true,
      overwrite: true,
    })
  })

  it('places every candidate review artifact in the indexed bundle directory', () => {
    const inputs = resolveP2CandidateAdvanceInputs({
      districtId: 'beitou',
      reviewRoot: '.tmp/reviews',
    })
    const paths = resolveCandidateReviewPaths(inputs)

    expect(paths.bundleDir).toBe(
      path.resolve('.tmp/reviews/beitou-human-review'),
    )
    expect(paths.sourcePath).toBe(
      path.join(paths.bundleDir, 'beitou-review.csv'),
    )
    expect(paths.handoffPath).toBe(
      path.join(paths.bundleDir, 'beitou-next-review.csv'),
    )
    expect(paths.checklistPath).toBe(
      path.join(paths.bundleDir, 'beitou-next-review.md'),
    )
    expect(paths.geojsonPath).toBe(
      path.join(paths.bundleDir, 'beitou-next-review.geojson'),
    )
  })

  it('rejects unsafe or current-district candidate ids', () => {
    expect(() =>
      resolveP2CandidateAdvanceInputs({ districtId: '../songshan' }),
    ).toThrow('must contain only')
    expect(() =>
      resolveP2CandidateAdvanceInputs({ districtId: 'xinyi' }),
    ).toThrow('must differ')
  })

  it('packages a missing handoff and stops at the human review boundary', async () => {
    const workflowRunners = runners([
      statusResult({
        nextAction: 'fill-human-review',
        pending: true,
      }),
      statusResult({
        nextAction: 'fill-human-review',
        pending: true,
        packaged: true,
      }),
    ])

    const result = await runP2CandidateAdvance(
      { districtId: 'songshan', execute: true },
      workflowRunners,
    )

    expect(result.stage).toBe('human-review-required')
    expect(result.pass).toBe(true)
    expect(workflowRunners.runAdvanceReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        districtIds: ['songshan'],
        configRoot: 'configs/expansion',
      }),
    )
    expect(workflowRunners.prepareReview).toHaveBeenCalledTimes(1)
    expect(workflowRunners.runPromotion).not.toHaveBeenCalled()
  })

  it('repairs the new-candidate deadlock when the only blocker is a missing bundle', async () => {
    const missingBundle = statusResult({
      nextAction: 'fix-blockers',
      status: 'BLOCKED',
      missingBundle: true,
      pass: false,
    })
    const workflowRunners = runners([
      missingBundle,
      statusResult({
        nextAction: 'fill-human-review',
        pending: true,
        packaged: true,
      }),
    ])

    expect(canCreateMissingReviewHandoff(missingBundle, 'songshan')).toBe(true)
    const result = await runP2CandidateAdvance(
      { districtId: 'songshan' },
      workflowRunners,
    )

    expect(result.stage).toBe('human-review-required')
    expect(result.handoffResult?.pass).toBe(true)
    expect(workflowRunners.runAdvanceReviews).toHaveBeenCalledTimes(1)
  })

  it('dry-runs finalize without promoting', async () => {
    const workflowRunners = runners([
      statusResult({
        nextAction: 'finalize-review',
        status: 'READY_TO_FINALIZE',
        ready: true,
      }),
    ])

    const result = await runP2CandidateAdvance(
      { districtId: 'songshan' },
      workflowRunners,
    )

    expect(result.stage).toBe('ready-to-finalize')
    expect(workflowRunners.runAdvanceReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        requireReadyToFinalize: true,
        execute: false,
        noPackage: true,
      }),
    )
    expect(workflowRunners.runPromotion).not.toHaveBeenCalled()
  })

  it('continues from successful finalize into promotion in execute mode', async () => {
    const workflowRunners = runners([
      statusResult({
        nextAction: 'finalize-review',
        status: 'READY_TO_FINALIZE',
        ready: true,
      }),
      statusResult({ nextAction: 'already-reviewed' }),
    ])

    const result = await runP2CandidateAdvance(
      { districtId: 'songshan', execute: true },
      workflowRunners,
    )

    expect(result.stage).toBe('promotion-complete')
    expect(workflowRunners.runPromotion).toHaveBeenCalledWith(
      expect.objectContaining({
        districtId: 'songshan',
        sourceRoot: 'configs/expansion',
        targetRoot: 'configs/prod',
        execute: true,
      }),
    )
  })

  it('recognizes published candidates without additional actions', async () => {
    const published = statusResult({ nextAction: 'published' })
    const workflowRunners = runners([published])

    expect(classifyP2CandidateStage(published)).toBe('published')
    const result = await runP2CandidateAdvance(
      { districtId: 'songshan', execute: true },
      workflowRunners,
    )

    expect(result.stage).toBe('published')
    expect(workflowRunners.runAdvanceReviews).not.toHaveBeenCalled()
    expect(workflowRunners.runPromotion).not.toHaveBeenCalled()
  })
})
