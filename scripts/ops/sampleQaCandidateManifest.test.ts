import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildQaCandidateManifest } from './sampleQaCandidateManifest'
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
  flags: [],
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

describe('buildQaCandidateManifest', () => {
  it('captures reproducible review packet context and row distribution', () => {
    const csvPath = path.join('tmp', 'xinyi-review.csv')
    const manifest = buildQaCandidateManifest({
      districtId: 'xinyi',
      csvPath,
      datasetBaseDir: path.join('public', 'data', 'generated', 'xinyi'),
      datasetMeta: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        datasetHash: 'hash-a',
        configHash: 'hash-b',
        generatedAt: '2026-04-25T00:00:00.000Z',
        counts: {
          segments: 10,
          busStops: 1,
          hydrants: 1,
          zones: 0,
        },
      },
      inputCounts: {
        redYellow: 10,
        busStops: 1,
        hydrants: 1,
        intersections: 0,
        crosswalks: 0,
        signOverrides: 0,
        inferredCandidates: 3,
        parkingSpaces: 4,
      },
      rows: [
        buildRow(),
        buildRow({
          segmentId: 'seg-2',
          score: '0.5000',
          reviewBucket: 'no_stop',
          tier: 'RED',
          allowedNow: 'NO_STOP',
          parkingSpaceCount: '0',
          topReasons: ['RULE_RED_NO_STOP'],
        }),
      ],
      topN: 80,
      riskMode: 'NEUTRAL',
      radiusMeters: 5000,
      shuffle: false,
      seed: 1,
      strategy: 'review',
      hhmm: '21:00',
      requiredSegmentIds: ['candidate-critical'],
      anchorLocation: [121.515, 25.114],
      createdAt: '2026-04-25T01:00:00.000Z',
    })

    expect(manifest.dataset.datasetHash).toBe('hash-a')
    expect(manifest.dataset.inputCounts.parkingSpaces).toBe(4)
    expect(manifest.params).toMatchObject({
      topN: 80,
      strategy: 'review',
      hhmm: '21:00',
      requiredSegmentIds: ['candidate-critical'],
      anchorLocation: [121.515, 25.114],
    })
    expect(manifest.rows.bucketCounts).toEqual({
      marked_space_park: 1,
      no_stop: 1,
    })
    expect(manifest.rows.rowsWithParkingSpaces).toBe(1)
    expect(manifest.rows.reviewSourceCounts).toEqual({ pending: 2 })
    expect(manifest.rows.minScore).toBe(0.5)
    expect(manifest.rows.maxScore).toBe(0.8123)
    expect(manifest.review.validStatuses).toEqual(['LEGAL', 'ILLEGAL', 'UNCLEAR'])
    expect(manifest.review.gateCommand).toContain('ops:qa-review-gate')
    expect(manifest.review.gateCommand).toContain('tmp/xinyi-review.csv')
    expect(manifest.review.gateCommand).toContain('configs/prod/xinyi.json')
  })

  it('uses a custom config root in the review gate command', () => {
    const manifest = buildQaCandidateManifest({
      districtId: 'songshan',
      csvPath: path.join('tmp', 'songshan-review.csv'),
      configRoot: 'configs/expansion',
      datasetBaseDir: path.join('public', 'data', 'generated', 'songshan'),
      datasetMeta: null,
      inputCounts: {
        redYellow: 1,
        busStops: 0,
        hydrants: 0,
        intersections: 0,
        crosswalks: 0,
        signOverrides: 0,
        inferredCandidates: 0,
        parkingSpaces: 0,
      },
      rows: [buildRow({ districtId: 'songshan' })],
      topN: 1,
      riskMode: 'NEUTRAL',
      radiusMeters: 600,
      shuffle: false,
      seed: 1,
      strategy: 'review',
      hhmm: '13:00',
      createdAt: '2026-04-25T01:00:00.000Z',
    })

    expect(manifest.review.gateCommand).toContain(
      'configs/expansion/songshan.json',
    )
  })
})
