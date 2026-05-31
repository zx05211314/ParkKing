import { describe, expect, it } from 'vitest'
import { buildQaCandidateManifest } from './sampleQaCandidateManifest'
import { renderQaCandidateReviewDoc } from './sampleQaCandidateReviewDoc'
import type { QaCandidateRow } from './sampleQaCandidateTypes'

const buildRow = (params: Partial<QaCandidateRow> = {}): QaCandidateRow => ({
  districtId: 'xinyi',
  segmentId: 'seg-1',
  lat: '25.050000',
  lon: '121.500000',
  score: '0.8123',
  reviewBucket: 'marked_space_park',
  tier: 'GREEN',
  allowedNow: 'PARK',
  curbMarking: 'NONE',
  sourceType: 'CURB',
  sourceReliability: 'HIGH',
  dataFreshnessDays: '',
  finalConfidence: 'HIGH',
  coverageConfidence: 'HIGH',
  overrideConfidence: 'HIGH',
  parkingSpaceCount: '2',
  topReasons: ['PARKING_SPACE_EVIDENCE'],
  flags: ['staleData'],
  riskTags: [],
  signOverrideStatus: '',
  signOverrideSource: '',
  signOverrideVerifiedAt: '',
  signOverrideNote: '',
  mapsUrl: 'https://www.google.com/maps?q=25.050000,121.500000',
  streetViewUrl:
    'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=25.050000,121.500000',
  reviewSource: '',
  reviewStatus: '',
  reviewNote: '',
  createdAt: '',
  ...params,
})

describe('renderQaCandidateReviewDoc', () => {
  it('renders a human review checklist without filling verdicts', () => {
    const rows = [
      buildRow(),
      buildRow({
        segmentId: 'seg-2',
        reviewBucket: 'no_stop',
        tier: 'RED',
        allowedNow: 'NO_STOP',
        parkingSpaceCount: '0',
        topReasons: ['RULE_RED_NO_STOP'],
        flags: [],
      }),
    ]
    const manifest = buildQaCandidateManifest({
      districtId: 'xinyi',
      csvPath: '.tmp/xinyi-review.csv',
      datasetBaseDir: 'public/data/generated/xinyi',
      datasetMeta: {
        districtId: 'xinyi',
        datasetHash: 'hash-a',
        configHash: 'hash-b',
        generatedAt: '2026-04-25T00:00:00.000Z',
        counts: {
          segments: 2,
          busStops: 0,
          hydrants: 0,
          signOverrides: 0,
          overridesApplied: 0,
          zones: 0,
        },
      },
      inputCounts: {
        redYellow: 2,
        busStops: 0,
        hydrants: 0,
        intersections: 0,
        crosswalks: 0,
        signOverrides: 0,
        inferredCandidates: 0,
        parkingSpaces: 2,
      },
      rows,
      topN: 2,
      riskMode: 'NEUTRAL',
      radiusMeters: 5000,
      shuffle: false,
      seed: 1,
      strategy: 'review',
      hhmm: '21:00',
      createdAt: '2026-04-25T00:00:00.000Z',
    })

    const doc = renderQaCandidateReviewDoc(manifest, rows)

    expect(doc).toContain('# QA Review Packet: xinyi')
    expect(doc).toContain('Do not fill verdicts from model inference alone.')
    expect(doc).toContain('## Bucket: marked_space_park')
    expect(doc).toContain('## Bucket: no_stop')
    expect(doc).toContain('Segment `seg-1`')
    expect(doc).toContain('CSV row: 2')
    expect(doc).toContain('CSV row: 3')
    expect(doc).toContain('[Street View](')
    expect(doc).toContain('Verdict: LEGAL / ILLEGAL / UNCLEAR')
    expect(doc).toContain('npm run ops:qa-review-gate')
  })
})
