import { runBenchmark } from '../bench/benchEvaluate'
import { median } from './generateBaselineStats'

export const runMedianBench = async (datasetDir: string, hhmm: string, runs = 3) => {
  const results = []
  for (let i = 0; i < runs; i += 1) {
    const result = await runBenchmark(datasetDir, hhmm)
    results.push(result)
  }
  return {
    medianEvalFirstMs: median(results.map((result) => result.timingsMs.evalFirst)),
    medianEvalSecondMs: median(results.map((result) => result.timingsMs.evalSecond)),
    distribution: results[0]?.distribution ?? {},
    reasonCodes: results[0]?.reasonCodes ?? { coveragePct: 0, counts: {}, byTier: {} },
    evaluatedCount: results[0]?.counts?.evaluatedFirst ?? 0,
  }
}
