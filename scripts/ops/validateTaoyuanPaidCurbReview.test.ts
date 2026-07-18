import { describe, expect, it } from 'vitest'
import type { PaidCurbReferencePack } from '../../src/data/paidCurbReference'
import {
  validateTaoyuanPaidCurbReview,
  type CsvRow,
  type ReviewManifest,
} from './validateTaoyuanPaidCurbReview'

const pack: PaidCurbReferencePack = {
  schemaVersion: 1,
  regionId: 'taoyuan',
  evidenceKind: 'PAID_CURB_SEGMENT_TEXT',
  geometryAvailable: false,
  legalAnswerEligible: false,
  requiresHumanReview: true,
  source: {
    dataset: 'Taoyuan City curb parking segment list',
    relativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
    sha256: 'a'.repeat(64),
    recordCount: 1,
  },
  districts: [
    {
      districtId: 'taoyuan-district',
      districtName: 'Taoyuan',
      boundaryFeatureId: '68000010',
      recordCount: 1,
      records: [
        {
          parkingSegmentId: '169',
          description: 'Xianfu Road',
          fareDescription: '20 per 30 minutes',
          hasChargingPoint: false,
          sourceTownName: 'Taoyuan District',
        },
      ],
    },
  ],
}

const manifest: ReviewManifest = {
  schemaVersion: 1,
  districtId: 'taoyuan-district',
  sourceSha256: 'a'.repeat(64),
  sourceRecordCount: 1,
  reviewRecordCount: 1,
  geometryAvailable: false,
  legalAnswerEligible: false,
  allowedStatuses: [
    'APPROVED_SOURCE_TEXT',
    'NEEDS_CORRECTION',
    'UNCLEAR',
  ],
}

const row: CsvRow = {
  parking_segment_id: '169',
  district_id: 'taoyuan-district',
  district_name: 'Taoyuan',
  description: 'Xianfu Road',
  fare_description: '20 per 30 minutes',
  has_charging_point: 'false',
  geometry_available: 'false',
  legal_answer_eligible: 'false',
  source_text_review_status: '',
  source_text_review_note: '',
}

describe('validateTaoyuanPaidCurbReview', () => {
  it('reports structurally valid pending review without treating it as approved', () => {
    const status = validateTaoyuanPaidCurbReview({
      pack,
      manifest,
      rows: [row],
      districtId: 'taoyuan-district',
    })
    expect(status).toMatchObject({
      pass: true,
      structureValid: true,
      complete: false,
      approved: false,
      statusCounts: { PENDING: 1 },
    })

    const gate = validateTaoyuanPaidCurbReview({
      pack,
      manifest,
      rows: [row],
      districtId: 'taoyuan-district',
      requireApproved: true,
    })
    expect(gate.pass).toBe(false)
    expect(gate.errors).toContain('1 source-text review rows are still pending.')
  })

  it('passes the approval gate only when every immutable row is approved', () => {
    const result = validateTaoyuanPaidCurbReview({
      pack,
      manifest,
      rows: [{ ...row, source_text_review_status: 'APPROVED_SOURCE_TEXT' }],
      districtId: 'taoyuan-district',
      requireApproved: true,
    })
    expect(result).toMatchObject({
      pass: true,
      structureValid: true,
      complete: true,
      approved: true,
    })
  })

  it('rejects source drift and requires notes for unresolved rows', () => {
    const drifted = validateTaoyuanPaidCurbReview({
      pack,
      manifest,
      rows: [{ ...row, description: 'Changed text' }],
      districtId: 'taoyuan-district',
    })
    expect(drifted.structureValid).toBe(false)
    expect(drifted.errors).toContain(
      'Row 2: description does not match the reference pack.',
    )

    const unresolved = validateTaoyuanPaidCurbReview({
      pack,
      manifest,
      rows: [{ ...row, source_text_review_status: 'UNCLEAR' }],
      districtId: 'taoyuan-district',
    })
    expect(unresolved.structureValid).toBe(false)
    expect(unresolved.errors).toContain(
      'Row 2: UNCLEAR requires source_text_review_note.',
    )
  })

  it('rejects a promoted manifest when its review CSV hash drifts', () => {
    const result = validateTaoyuanPaidCurbReview({
      pack,
      manifest: {
        ...manifest,
        reviewSha256: 'b'.repeat(64),
        approvedRecordCount: 1,
      },
      rows: [{ ...row, source_text_review_status: 'APPROVED_SOURCE_TEXT' }],
      districtId: 'taoyuan-district',
      reviewSha256: 'c'.repeat(64),
      requireApproved: true,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Review manifest reviewSha256 does not match the review CSV.',
    )
  })

  it('requires hash and approved count pins for promoted evidence', () => {
    const result = validateTaoyuanPaidCurbReview({
      pack,
      manifest,
      rows: [{ ...row, source_text_review_status: 'APPROVED_SOURCE_TEXT' }],
      districtId: 'taoyuan-district',
      reviewSha256: 'a'.repeat(64),
      requirePinnedReview: true,
      requireApproved: true,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Review manifest must pin reviewSha256 for promoted evidence.',
    )
    expect(result.errors).toContain(
      'Review manifest must pin approvedRecordCount for promoted evidence.',
    )
  })
})
