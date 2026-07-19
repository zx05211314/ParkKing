import { describe, expect, it } from 'vitest'
import {
  buildSmokeParkingAnswerServiceCaseResult,
  parseSmokeParkingAnswerServiceArgs,
  resolveSmokeParkingAnswerServiceRuntime,
} from './smokeParkingAnswerService'
import type { SmokeExactParkingAnswerCase } from './smokeExactParkingAnswers'

const answerCase: SmokeExactParkingAnswerCase = {
  id: 'case-1',
  coverageAreaId: 'shipai',
  lng: 121.56,
  lat: 25.03,
  expectedKind: 'PARK',
  expectedEvidenceKind: 'MARKED_SPACE',
  expectedPrimarySegmentId: 'seg-1',
  expectedFinalConfidence: 'HIGH',
  minParkingSpaceCount: 2,
}

describe('smokeParkingAnswerService', () => {
  it('parses service smoke options', () => {
    expect(
      parseSmokeParkingAnswerServiceArgs([
        'node',
        'smokeParkingAnswerService',
        '--district',
        'xinyi',
        '--cases',
        'cases.json',
        '--endpoint',
        'http://localhost:8790/api/parking-answer',
        '--timeout-ms',
        '12000',
        '--max-cases',
        '3',
        '--allow-mismatched-case-hash',
      ]),
    ).toEqual({
      district: 'xinyi',
      datasetDir: undefined,
      casesPath: 'cases.json',
      endpoint: 'http://localhost:8790/api/parking-answer',
      port: undefined,
      timeoutMs: 12000,
      maxCases: 3,
      hhmm: '21:00',
      searchRadiusMeters: 25,
      minParkAnswers: undefined,
      minNoStopAnswers: undefined,
      minMarkedSpaceParkAnswers: undefined,
      skipHealthCheck: false,
      allowMismatchedCaseHash: true,
    })
  })

  it('parses generated sample smoke options without a cases file', () => {
    expect(
      parseSmokeParkingAnswerServiceArgs([
        'node',
        'smokeParkingAnswerService',
        '--district',
        'xinyi',
        '--no-cases',
        '--dataset-dir',
        'public/data/generated/xinyi',
        '--hhmm',
        '13:00',
        '--radius',
        '40',
        '--minParkAnswers',
        '1',
        '--skip-health-check',
      ]),
    ).toMatchObject({
      district: 'xinyi',
      datasetDir: 'public/data/generated/xinyi',
      casesPath: undefined,
      hhmm: '13:00',
      searchRadiusMeters: 40,
      minParkAnswers: 1,
      skipHealthCheck: true,
    })
  })

  it('points readiness at the dataset-dir parent for dry-run packs', () => {
    expect(
      resolveSmokeParkingAnswerServiceRuntime({
        district: 'xinyi',
        datasetDir: 'data/generated/xinyi',
      }),
    ).toMatchObject({
      sampleDatasetDir: 'data/generated/xinyi',
      serviceDistrict: 'xinyi',
    })
    expect(
      resolveSmokeParkingAnswerServiceRuntime({
        district: 'xinyi',
        datasetDir: 'data/generated/xinyi',
      }).serviceDatasetRoot,
    ).toMatch(/data[\\/]generated$/)
  })

  it('validates the HTTP response against a reviewed answer case', () => {
    expect(
      buildSmokeParkingAnswerServiceCaseResult({
        answerCase,
        responseStatus: 200,
        expectedDatasetHash: 'hash-1',
        payload: {
          schemaVersion: 1,
          datasetHash: 'hash-1',
          answer: {
            kind: 'PARK',
            primary: {
              id: 'seg-1',
              finalConfidence: 'HIGH',
            },
            evidence: {
              kind: 'MARKED_SPACE',
              parkingSpaceCount: 2,
            },
          },
          trustSummary: {
            trustLabel: 'High trust',
          },
        },
      }),
    ).toMatchObject({
      id: 'case-1',
      coverageAreaId: 'shipai',
      pass: true,
      answerKind: 'PARK',
      primarySegmentId: 'seg-1',
      evidenceKind: 'MARKED_SPACE',
      trustLabel: 'High trust',
    })
  })
})
