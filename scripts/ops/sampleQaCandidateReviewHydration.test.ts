import { describe, expect, it } from 'vitest'
import type { QaCandidateRow } from './sampleQaCandidateTypes'
import { hydrateQaRowsWithReviewReports } from './sampleQaCandidateReviewHydration'
import type { SegmentReport } from './exportOverrideTypes'

const row = (overrides: Partial<QaCandidateRow>): QaCandidateRow => ({
  districtId: 'xinyi',
  segmentId: 'seg-1',
  lat: '25.000000',
  lon: '121.000000',
  score: '1.0000',
  reviewBucket: 'park',
  tier: 'GREEN',
  allowedNow: 'PARK',
  curbMarking: 'YELLOW',
  sourceType: 'CURB',
  sourceReliability: 'HIGH',
  dataFreshnessDays: '1',
  finalConfidence: 'HIGH',
  coverageConfidence: 'HIGH',
  overrideConfidence: '',
  parkingSpaceCount: '0',
  topReasons: [],
  flags: [],
  riskTags: [],
  signOverrideStatus: '',
  signOverrideSource: '',
  signOverrideVerifiedAt: '',
  signOverrideNote: '',
  mapsUrl: '',
  streetViewUrl: '',
  reviewSource: '',
  reviewStatus: '',
  reviewNote: '',
  createdAt: '',
  ...overrides,
})

const report = (overrides: Partial<SegmentReport>): SegmentReport => ({
  schemaVersion: 2,
  districtId: 'xinyi',
  segmentId: 'seg-1',
  status: 'LEGAL',
  note: 'approved from imagery',
  createdAt: '2026-02-01T00:00:00Z',
  reviewedSegmentId: 'seg-1',
  reviewedHhmm: '21:00',
  ...overrides,
})

describe('hydrateQaRowsWithReviewReports', () => {
  it('does not hydrate a sibling part from a part-scoped review', () => {
    const rows = hydrateQaRowsWithReviewReports(
      [row({ segmentId: 'seg-1-part-2' })],
      'xinyi',
      [
        report({
          segmentId: 'seg-1',
          reviewedSegmentId: 'seg-1-part-1',
        }),
      ],
    )

    expect(rows[0]?.reviewStatus).toBe('')
  })

  it('prefills the exact row matching a stored part-scoped review', () => {
    const rows = hydrateQaRowsWithReviewReports(
      [row({ segmentId: 'seg-1-part-1' })],
      'xinyi',
      [report({ reviewedSegmentId: 'seg-1-part-1' })],
    )

    expect(rows[0]?.reviewStatus).toBe('LEGAL')
    expect(rows[0]?.reviewSource).toBe('stored_override')
  })

  it('hydrates only the answer-consistent split row for a reviewed segment', () => {
    const rows = hydrateQaRowsWithReviewReports(
      [
        row({ segmentId: 'seg-9-part-1', allowedNow: 'NO_STOP' }),
        row({ segmentId: 'seg-9-part-2', allowedNow: 'PARK' }),
      ],
      'xinyi',
      [
        report({
          segmentId: 'seg-9',
          reviewedSegmentId: 'seg-9',
          status: 'LEGAL',
        }),
      ],
    )

    expect(rows[0]?.reviewStatus).toBe('')
    expect(rows[1]?.reviewStatus).toBe('LEGAL')
  })

  it('does not hydrate a legal report onto a no-stop-only candidate', () => {
    const rows = hydrateQaRowsWithReviewReports(
      [row({ segmentId: 'seg-2-part-1', allowedNow: 'NO_STOP' })],
      'xinyi',
      [report({ segmentId: 'seg-2', status: 'LEGAL' })],
    )

    expect(rows[0]?.reviewStatus).toBe('')
  })

  it('keeps existing manual review cells untouched', () => {
    const rows = hydrateQaRowsWithReviewReports(
      [
        row({
          segmentId: 'seg-1',
          reviewStatus: 'UNCLEAR',
          reviewNote: 'manual note',
          createdAt: '2026-03-01T00:00:00Z',
        }),
      ],
      'xinyi',
      [report({ status: 'LEGAL' })],
    )

    expect(rows[0]?.reviewStatus).toBe('UNCLEAR')
    expect(rows[0]?.reviewNote).toBe('manual note')
    expect(rows[0]?.createdAt).toBe('2026-03-01T00:00:00Z')
  })
})
