import { describe, expect, it, vi } from 'vitest'
import type { BenchmarkResult } from '../bench/benchEvaluate'
import { runRefreshPublishReportBenchmarks } from './refreshPublishReportState'

const benchmarkResult = (hhmm: string, evalSecond: number): BenchmarkResult => ({
  datasetHash: 'hash-1',
  hhmm,
  counts: { segments: 1, zones: 1, evaluatedFirst: 1, evaluatedSecond: 1 },
  distribution: {},
  reasonCodes: { coveragePct: 100, counts: {}, byTier: {} },
  timingsMs: {
    load: 1,
    buildSegments: 1,
    buildZones: 1,
    zoneIndex: 1,
    evalFirst: evalSecond + 100,
    evalSecond,
  },
  cache: { hits: 1, misses: 0, size: 1, maxEntries: 1, secondPassHitRate: 1 },
})

describe('runRefreshPublishReportBenchmarks', () => {
  it('runs day and night benchmarks sequentially to isolate shared cache metrics', async () => {
    let activeRuns = 0
    let maxActiveRuns = 0
    const calls: string[] = []
    const timings = [30, 10, 20, 60, 40, 50]
    const benchmark = vi.fn(async (_datasetDir: string, hhmm: string) => {
      activeRuns += 1
      maxActiveRuns = Math.max(maxActiveRuns, activeRuns)
      calls.push(`start:${hhmm}`)
      await Promise.resolve()
      calls.push(`end:${hhmm}`)
      activeRuns -= 1
      return benchmarkResult(hhmm, timings[benchmark.mock.calls.length - 1] ?? 0)
    })

    const result = await runRefreshPublishReportBenchmarks({
      datasetDir: 'public/data/generated/xinyi',
      dayHhmm: '13:00',
      nightHhmm: '21:00',
      benchmark,
    })

    expect(maxActiveRuns).toBe(1)
    expect(calls).toEqual([
      'start:13:00',
      'end:13:00',
      'start:13:00',
      'end:13:00',
      'start:13:00',
      'end:13:00',
      'start:21:00',
      'end:21:00',
      'start:21:00',
      'end:21:00',
      'start:21:00',
      'end:21:00',
    ])
    expect(result.dayEval.hhmm).toBe('13:00')
    expect(result.dayEval.timingsMs.evalSecond).toBe(20)
    expect(result.nightEval.hhmm).toBe('21:00')
    expect(result.nightEval.timingsMs.evalSecond).toBe(50)
  })
})
