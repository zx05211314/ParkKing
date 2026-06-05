import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { EvaluatedSegment } from '../../src/ui/types'
import {
  buildSmokeExactParkingAnswersSummary,
  loadSmokeExactParkingAnswerCases,
  parseSmokeExactParkingAnswersArgs,
  renderSmokeExactParkingAnswersSummary,
  runSmokeExactParkingAnswers,
  validateSmokeExactParkingAnswersSummary,
} from './smokeExactParkingAnswers'

const makeSegment = (
  overrides: Partial<EvaluatedSegment> & Pick<EvaluatedSegment, 'id' | 'path'>,
): EvaluatedSegment => ({
  id: overrides.id,
  name: overrides.name ?? overrides.id,
  path: overrides.path,
  curbMarking: overrides.curbMarking ?? 'YELLOW',
  confidence: overrides.confidence ?? 'HIGH',
  tier: overrides.tier ?? 'GREEN',
  allowedNow: overrides.allowedNow ?? 'PARK',
  reasonCodes: overrides.reasonCodes ?? ['RULE_YELLOW_NIGHT_PARK_POSSIBLE'],
  reasons: overrides.reasons ?? ['night parking allowed'],
  timeWindows: overrides.timeWindows ?? [],
  coverageConfidence: overrides.coverageConfidence ?? 'HIGH',
  overrideConfidence: overrides.overrideConfidence ?? 'HIGH',
  finalConfidence: overrides.finalConfidence ?? 'HIGH',
  sourceReliability: overrides.sourceReliability ?? 'HIGH',
  dataFreshnessDays: overrides.dataFreshnessDays ?? 2,
  parkingSpaceCount: overrides.parkingSpaceCount,
  sourceType: overrides.sourceType,
  source: overrides.source,
  riskTags: overrides.riskTags,
  signOverride: overrides.signOverride,
})

describe('smokeExactParkingAnswers', () => {
  it('parses dataset, time, radius, and thresholds', () => {
    expect(
      parseSmokeExactParkingAnswersArgs([
        'node',
        'smokeExactParkingAnswers',
        '--dataset-dir',
        'public/data/generated/xinyi',
        '--hhmm',
        '22:30',
        '--radius',
        '35',
        '--minParkAnswers',
        '2',
        '--minNoStopAnswers',
        '3',
      '--minMarkedSpaceParkAnswers',
      '1',
      '--cases',
      'configs/prod/xinyi.answer-cases.json',
      '--allow-unpinned-cases',
      '--allow-mismatched-case-hash',
    ]),
    ).toEqual({
      datasetDir: 'public/data/generated/xinyi',
      hhmm: '22:30',
      searchRadiusMeters: 35,
      minParkAnswers: 2,
      minNoStopAnswers: 3,
      minMarkedSpaceParkAnswers: 1,
      casesPath: 'configs/prod/xinyi.answer-cases.json',
      allowUnpinnedCases: true,
      allowMismatchedCaseHash: true,
    })
  })

  it('builds exact-answer smoke samples from real answer selection', () => {
    const segments = [
      makeSegment({
        id: 'park-space',
        path: [
          [121.56, 25.03],
          [121.5602, 25.03],
        ],
        parkingSpaceCount: 2,
        reasonCodes: ['RULE_YELLOW_NIGHT_PARK_POSSIBLE', 'PARKING_SPACE_EVIDENCE'],
      }),
      makeSegment({
        id: 'no-stop',
        path: [
          [121.56, 25.032],
          [121.5602, 25.032],
        ],
        curbMarking: 'RED',
        tier: 'RED',
        allowedNow: 'NO_STOP',
        reasonCodes: ['RULE_RED_NO_STOP'],
        reasons: ['red curb'],
      }),
    ]

    const summary = buildSmokeExactParkingAnswersSummary({
      datasetDir: 'fixture',
      datasetHash: 'hash-1',
      hhmm: '21:00',
      segments,
      searchRadiusMeters: 30,
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minMarkedSpaceParkAnswers: 1,
    })

    expect(summary.counts).toEqual({
      parkAnswers: 1,
      noStopAnswers: 1,
      markedSpaceParkAnswers: 1,
    })
    expect(summary.samples.map((sample) => sample.sampleKind)).toEqual([
      'PARK',
      'NO_STOP',
      'MARKED_SPACE_PARK',
    ])
    expect(validateSmokeExactParkingAnswersSummary(summary, {
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minMarkedSpaceParkAnswers: 1,
    })).toEqual([])
    expect(renderSmokeExactParkingAnswersSummary(summary)).toContain(
      'Exact parking answer summary: fixture',
    )
    expect(renderSmokeExactParkingAnswersSummary(summary)).toContain(
      'confidence HIGH; evidence MARKED_SPACE',
    )
  })

  it('fails validation when a required exact answer category is missing', () => {
    const summary = buildSmokeExactParkingAnswersSummary({
      datasetDir: 'fixture',
      datasetHash: 'hash-1',
      hhmm: '21:00',
      segments: [
        makeSegment({
          id: 'park-only',
          path: [
            [121.56, 25.03],
            [121.5602, 25.03],
          ],
        }),
      ],
      searchRadiusMeters: 30,
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minMarkedSpaceParkAnswers: 1,
    })

    expect(validateSmokeExactParkingAnswersSummary(summary, {
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minMarkedSpaceParkAnswers: 1,
    })).toEqual([
      'exact NO_STOP answers 0 below required 1',
      'marked-space-backed exact PARK answers 0 below required 1',
    ])
  })

  it('fails validation when a pinned answer case drifts', () => {
    const summary = buildSmokeExactParkingAnswersSummary({
      datasetDir: 'fixture',
      datasetHash: 'hash-1',
      hhmm: '21:00',
      segments: [],
      searchRadiusMeters: 30,
      minParkAnswers: 0,
      minNoStopAnswers: 0,
      minMarkedSpaceParkAnswers: 0,
      caseResults: [
        {
          id: 'case-1',
          label: null,
          hhmm: '21:00',
          location: [121.56, 25.03],
          searchRadiusMeters: 30,
          expectedKind: 'PARK',
          answerKind: 'NO_STOP',
          expectedEvidenceKind: 'MARKED_SPACE',
          evidenceKind: 'CURB_RULE',
          expectedPrimarySegmentId: 'seg-1',
          primarySegmentId: 'seg-2',
          distanceMeters: 2,
          parkingSpaceCount: 0,
          pass: false,
          errors: [
            'expected kind PARK, got NO_STOP',
            'expected primary seg-1, got seg-2',
          ],
        },
      ],
    })

    expect(
      validateSmokeExactParkingAnswersSummary(summary, {
        minParkAnswers: 0,
        minNoStopAnswers: 0,
        minMarkedSpaceParkAnswers: 0,
      }),
    ).toEqual([
      'answer case case-1 failed: expected kind PARK, got NO_STOP; expected primary seg-1, got seg-2',
    ])
    expect(renderSmokeExactParkingAnswersSummary(summary)).toContain(
      'Answer cases: 0/1 passed',
    )
  })

  it('fails fast when answer cases are not pinned to a dataset hash', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-exact-cases-'))
    const casesPath = path.join(base, 'cases.json')
    await fs.writeFile(
      casesPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          districtId: 'xinyi',
          cases: [
            {
              id: 'case-1',
              lng: 121.5645,
              lat: 25.0335,
              expectedKind: 'PARK',
            },
          ],
        },
        null,
        2,
      ),
    )

    await expect(
      runSmokeExactParkingAnswers({
        datasetDir: 'tests/fixtures/xinyi',
        minParkAnswers: 0,
        minNoStopAnswers: 0,
        minMarkedSpaceParkAnswers: 0,
        casesPath,
      }),
    ).rejects.toThrow('Answer cases file must include datasetHash')
  })

  it('keeps hash pinning strict unless mismatched case hashes are explicitly allowed', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-exact-stale-'))
    const casesPath = path.join(base, 'cases.json')
    await fs.writeFile(
      casesPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          districtId: 'xinyi',
          datasetHash: 'stale-hash',
          cases: [
            {
              id: 'case-1',
              lng: 121.56385035,
              lat: 25.033,
              hhmm: '21:00',
              expectedKind: 'PARK',
              expectedEvidenceKind: 'CURB_RULE',
              expectedPrimarySegmentId: 'seg-1-part-1',
              expectedFinalConfidence: 'MED',
            },
          ],
        },
        null,
        2,
      ),
    )

    const options = {
      datasetDir: 'tests/fixtures/xinyi',
      hhmm: '21:00',
      minParkAnswers: 0,
      minNoStopAnswers: 0,
      minMarkedSpaceParkAnswers: 0,
      casesPath,
    }

    await expect(runSmokeExactParkingAnswers(options)).rejects.toThrow(
      'Answer cases datasetHash stale-hash does not match runtime datasetHash fixture-xinyi-v7',
    )
    await expect(
      runSmokeExactParkingAnswers({
        ...options,
        allowMismatchedCaseHash: true,
      }),
    ).resolves.toMatchObject({
      caseResults: [expect.objectContaining({ id: 'case-1', pass: true })],
    })
  })

  it('normalizes MEDIUM confidence in answer-case files to runtime MED confidence', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-exact-confidence-'))
    const casesPath = path.join(base, 'cases.json')
    await fs.writeFile(
      casesPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          districtId: 'xinyi',
          datasetHash: 'hash-1',
          cases: [
            {
              id: 'case-1',
              lng: 121.5645,
              lat: 25.0335,
              expectedKind: 'PARK',
              expectedFinalConfidence: 'MEDIUM',
            },
          ],
        },
        null,
        2,
      ),
    )

    await expect(loadSmokeExactParkingAnswerCases(casesPath)).resolves.toMatchObject({
      cases: [{ expectedFinalConfidence: 'MED' }],
    })
  })

  it('passes against the fixture district pack for exact curb answers', async () => {
    const summary = await runSmokeExactParkingAnswers({
      datasetDir: 'tests/fixtures/xinyi',
      hhmm: '21:00',
      searchRadiusMeters: 25,
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minMarkedSpaceParkAnswers: 0,
    })

    expect(summary.datasetHash).toBe('fixture-xinyi-v7')
    expect(summary.counts.parkAnswers).toBe(1)
    expect(summary.counts.noStopAnswers).toBe(1)
    expect(summary.counts.markedSpaceParkAnswers).toBe(0)
    expect(summary.samples.map((sample) => sample.answerKind)).toEqual([
      'PARK',
      'NO_STOP',
    ])
  })
})
