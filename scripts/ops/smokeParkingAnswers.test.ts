import { describe, expect, it } from 'vitest'
import {
  buildSmokeParkingAnswersSummary,
  parseSmokeParkingAnswersArgs,
  renderSmokeParkingAnswersSummary,
  runSmokeParkingAnswers,
  validateSmokeParkingAnswersSummary,
} from './smokeParkingAnswers'
import type { BenchmarkResult } from '../bench/benchEvaluate'

const makeBenchmark = (
  hhmm: string,
  distribution: Record<string, number>,
): BenchmarkResult => ({
  datasetHash: 'fixture-hash',
  hhmm,
  counts: {
    segments: 3,
    zones: 2,
    evaluatedFirst: Object.values(distribution).reduce((sum, count) => sum + count, 0),
    evaluatedSecond: Object.values(distribution).reduce((sum, count) => sum + count, 0),
  },
  distribution,
  reasonCodes: {
    coveragePct: 100,
    counts: {
      RULE_YELLOW_NIGHT_PARK_POSSIBLE: 2,
    },
    byTier: {
      GREEN: {},
      YELLOW: {},
      RED: {},
    },
  },
  timingsMs: {
    load: 1,
    buildSegments: 1,
    buildZones: 1,
    zoneIndex: 1,
    evalFirst: 1,
    evalSecond: 1,
  },
  cache: {
    hits: 1,
    misses: 1,
    size: 1,
    maxEntries: 5000,
    secondPassHitRate: 1,
  },
})

describe('smokeParkingAnswers', () => {
  it('parses CLI options', () => {
    expect(
      parseSmokeParkingAnswersArgs([
        'node',
        'smokeParkingAnswers',
        '--datasetDir',
        'data/generated/xinyi',
        '--day',
        '12:00',
        '--night',
        '22:00',
        '--minSegments',
        '100',
        '--minParkAnswers',
        '10',
        '--minNoStopAnswers',
        '20',
        '--minReasonCoveragePct',
        '95',
      ]),
    ).toEqual({
      datasetDir: 'data/generated/xinyi',
      dayHHMM: '12:00',
      nightHHMM: '22:00',
      minSegments: 100,
      minParkAnswers: 10,
      minNoStopAnswers: 20,
      minReasonCoveragePct: 95,
    })
  })

  it('builds and renders answerability summary', () => {
    const summary = buildSmokeParkingAnswersSummary({
      datasetDir: 'tests/fixtures/xinyi',
      day: makeBenchmark('13:00', {
        'YELLOW|TEMP_STOP': 2,
        'RED|NO_STOP': 4,
      }),
      night: makeBenchmark('21:00', {
        'GREEN|PARK': 2,
        'YELLOW|PARK': 3,
        'RED|NO_STOP': 4,
      }),
    })

    expect(summary).toMatchObject({
      datasetDir: 'tests/fixtures/xinyi',
      datasetHash: 'fixture-hash',
      segmentCount: 3,
      dayParkAnswers: 0,
      dayNoStopAnswers: 4,
      nightParkAnswers: 5,
      nightNoStopAnswers: 4,
      nightGreenParkAnswers: 2,
      nightYellowParkAnswers: 3,
    })
    expect(validateSmokeParkingAnswersSummary(summary, {
      minSegments: 1,
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minReasonCoveragePct: 90,
    })).toEqual([])
    expect(renderSmokeParkingAnswersSummary(summary)).toContain(
      'Night 21:00: evaluated 9, PARK 5 (GREEN 2, YELLOW 3), NO_STOP 4',
    )
  })

  it('reports missing answerability clearly', () => {
    const summary = buildSmokeParkingAnswersSummary({
      datasetDir: 'tests/fixtures/xinyi',
      day: makeBenchmark('13:00', {
        'YELLOW|TEMP_STOP': 2,
      }),
      night: makeBenchmark('21:00', {
        'YELLOW|TEMP_STOP': 2,
      }),
    })

    expect(validateSmokeParkingAnswersSummary(summary, {
      minSegments: 10,
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minReasonCoveragePct: 101,
    })).toEqual([
      'segments 3 below required 10',
      'night PARK answers 0 below required 1',
      'night NO_STOP answers 0 below required 1',
      'day reason coverage 100.0% below required 101%',
      'night reason coverage 100.0% below required 101%',
    ])
  })

  it('passes against fixture district pack', async () => {
    const summary = await runSmokeParkingAnswers({
      datasetDir: 'tests/fixtures/xinyi',
      minSegments: 1,
      minParkAnswers: 1,
      minNoStopAnswers: 1,
      minReasonCoveragePct: 100,
    })

    expect(summary.nightParkAnswers).toBeGreaterThan(0)
    expect(summary.nightNoStopAnswers).toBeGreaterThan(0)
    expect(summary.nightReasonCoveragePct).toBe(100)
  })
})
