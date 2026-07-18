import { describe, expect, it, vi } from 'vitest'
import type {
  HumanReviewBundleIndexResult,
  SpecializedHumanReviewBundleEntry,
} from './humanReviewBundleIndex'
import {
  parsePromoteReadyTaoyuanReviewsArgs,
  promoteReadyTaoyuanPaidCurbReviews,
} from './promoteReadyTaoyuanPaidCurbReviews'

const sourceEntry = (
  districtId: string,
  status: SpecializedHumanReviewBundleEntry['status'],
): SpecializedHumanReviewBundleEntry => ({
  bundleId: 'taoyuan',
  bundleDir: '/review',
  districtId,
  contract: 'source-text',
  status,
  reviewPath: `/review/${districtId}.csv`,
  manifestPath: `/review/${districtId}.manifest.json`,
  statusPath: null,
  expectedRows: 1,
  actualRows: 1,
  pendingRows: status === 'pending' ? 1 : 0,
  statusCommand: 'status',
  gateCommand: 'gate',
  warnings: [],
  errors: [],
})

const indexResult = (
  entries: SpecializedHumanReviewBundleEntry[],
): HumanReviewBundleIndexResult => ({
  reviewRoot: '/review',
  publishGateSummaryPath: null,
  entries: [],
  specializedEntries: entries,
  finalizeReadyCount: 0,
  notReadyForFinalize: [],
  warnings: [],
  errors: [],
  hasWarnings: false,
  hasErrors: false,
})

describe('promoteReadyTaoyuanPaidCurbReviews', () => {
  it('parses report-only and strict execution options', () => {
    expect(
      parsePromoteReadyTaoyuanReviewsArgs([
        'node',
        'promote',
        '--review-dir',
        '.tmp/reviews',
        '--district',
        'zhongli,bade',
        '--execute',
        '--require-all-approved',
      ]),
    ).toMatchObject({
      reviewDir: '.tmp/reviews',
      districtIds: ['zhongli', 'bade'],
      execute: true,
      requireAllApproved: true,
    })
  })

  it('reports approved entries without writing in the default mode', async () => {
    const promoteReview = vi.fn()
    const result = await promoteReadyTaoyuanPaidCurbReviews(
      {},
      {
        runIndex: async () =>
          indexResult([
            sourceEntry('taoyuan-district', 'approved'),
            sourceEntry('zhongli', 'pending'),
          ]),
        promoteReview,
      },
    )

    expect(result.pass).toBe(true)
    expect(result.readyCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(promoteReview).not.toHaveBeenCalled()
  })

  it('executes only fully approved entries and reuses the hard promotion gate', async () => {
    const promoteReview = vi.fn(async ({ districtId }) => ({
      destinationReviewPath: `/tracked/${districtId}.csv`,
      destinationManifestPath: `/tracked/${districtId}.manifest.json`,
    }))
    const result = await promoteReadyTaoyuanPaidCurbReviews(
      { execute: true },
      {
        runIndex: async () =>
          indexResult([
            sourceEntry('taoyuan-district', 'approved'),
            sourceEntry('zhongli', 'pending'),
            sourceEntry('bade', 'invalid'),
          ]),
        promoteReview,
      },
    )

    expect(promoteReview).toHaveBeenCalledTimes(1)
    expect(promoteReview).toHaveBeenCalledWith(
      expect.objectContaining({ districtId: 'taoyuan-district' }),
    )
    expect(result.promotedCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(result.blockedCount).toBe(1)
    expect(result.pass).toBe(false)
  })

  it('fails strict mode while any selected district remains pending', async () => {
    const result = await promoteReadyTaoyuanPaidCurbReviews(
      { requireAllApproved: true },
      {
        runIndex: async () =>
          indexResult([
            sourceEntry('taoyuan-district', 'approved'),
            sourceEntry('zhongli', 'pending'),
          ]),
      },
    )

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      '1 Taoyuan district review(s) are not fully approved.',
    )
  })
})
