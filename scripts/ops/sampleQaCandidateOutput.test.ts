import { describe, expect, it } from 'vitest'
import {
  renderQaCandidatesCsv,
  resolveQaManifestOutPath,
  resolveQaOutPath,
  resolveQaReviewDocOutPath,
} from './sampleQaCandidateOutput'

describe('renderQaCandidatesCsv', () => {
  it('escapes arrays and urls into a deterministic CSV row', () => {
    const csv = renderQaCandidatesCsv([
      {
        districtId: 'demo',
        segmentId: 'seg-1',
        lat: '25.050000',
        lon: '121.500000',
        score: '0.8123',
        reviewBucket: 'ranked',
        tier: 'RED',
        allowedNow: 'NO_STOP',
        curbMarking: 'RED',
        sourceType: 'CURB',
        sourceReliability: 'HIGH',
        dataFreshnessDays: '12',
        finalConfidence: 'HIGH',
        coverageConfidence: 'HIGH',
        overrideConfidence: 'LOW',
        parkingSpaceCount: '0',
        topReasons: ['RULE_A', 'RULE_B'],
        flags: ['override', 'risk:MAJOR_ROAD'],
        riskTags: ['MAJOR_ROAD'],
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
      },
    ])

    expect(csv).toContain('topReasons[]')
    expect(csv).toContain('reviewBucket')
    expect(csv).toContain('curbMarking')
    expect(csv).toContain('riskTags')
    expect(csv).toContain('streetViewUrl')
    expect(csv).toContain('reviewSource')
    expect(csv).toContain('reviewStatus')
    expect(csv).toContain('"[""RULE_A"",""RULE_B""]"')
    expect(csv).toContain('https://www.google.com/maps?q=25.050000,121.500000')
  })
})

describe('resolveQaOutPath', () => {
  it('supports all-district template and csv suffix expansion', () => {
    expect(
      resolveQaOutPath({
        districtId: 'xinyi',
        all: true,
        outPath: 'tmp/{districtId}.csv',
      }),
    ).toMatch(/tmp[\\/]+xinyi\.csv$/)

    expect(
      resolveQaOutPath({
        districtId: 'daan',
        all: true,
        outPath: 'tmp\\qa.csv',
      }),
    ).toMatch(/tmp[\\/]+qa-daan\.csv$/)
  })
})

describe('resolveQaManifestOutPath', () => {
  it('defaults to a sidecar manifest next to the CSV', () => {
    expect(
      resolveQaManifestOutPath({
        districtId: 'xinyi',
        all: false,
        csvOutPath: 'tmp/xinyi-review.csv',
        manifestOutPath: null,
      }),
    ).toMatch(/tmp[\\/]+xinyi-review\.manifest\.json$/)
  })

  it('supports all-district manifest templates and json suffix expansion', () => {
    expect(
      resolveQaManifestOutPath({
        districtId: 'xinyi',
        all: true,
        csvOutPath: 'tmp/xinyi-review.csv',
        manifestOutPath: 'tmp/{districtId}.manifest.json',
      }),
    ).toMatch(/tmp[\\/]+xinyi\.manifest\.json$/)

    expect(
      resolveQaManifestOutPath({
        districtId: 'daan',
        all: true,
        csvOutPath: 'tmp/qa-daan.csv',
        manifestOutPath: 'tmp/qa.manifest.json',
      }),
    ).toMatch(/tmp[\\/]+qa\.manifest-daan\.json$/)
  })
})

describe('resolveQaReviewDocOutPath', () => {
  it('defaults to a sidecar review doc next to the CSV', () => {
    expect(
      resolveQaReviewDocOutPath({
        districtId: 'xinyi',
        all: false,
        csvOutPath: 'tmp/xinyi-review.csv',
        reviewDocOutPath: null,
      }),
    ).toMatch(/tmp[\\/]+xinyi-review\.review\.md$/)
  })

  it('supports all-district review doc templates and md suffix expansion', () => {
    expect(
      resolveQaReviewDocOutPath({
        districtId: 'xinyi',
        all: true,
        csvOutPath: 'tmp/xinyi-review.csv',
        reviewDocOutPath: 'tmp/{districtId}.review.md',
      }),
    ).toMatch(/tmp[\\/]+xinyi\.review\.md$/)

    expect(
      resolveQaReviewDocOutPath({
        districtId: 'daan',
        all: true,
        csvOutPath: 'tmp/qa-daan.csv',
        reviewDocOutPath: 'tmp/qa.review.md',
      }),
    ).toMatch(/tmp[\\/]+qa\.review-daan\.md$/)
  })
})
