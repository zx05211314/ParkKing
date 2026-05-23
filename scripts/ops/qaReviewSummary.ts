import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseQaReviewSummaryArgs } from './qaReviewSummaryArgs'
import {
  formatQaNextReviewRowsCsv,
  formatQaReviewSummary,
} from './qaReviewSummaryOutput'
import { buildQaReviewSummary } from './qaReviewSummaryState'
import type { QaReviewSummaryParams } from './qaReviewSummaryTypes'

export const qaReviewSummary = async (params: QaReviewSummaryParams) =>
  buildQaReviewSummary(params)

const run = async () => {
  const args = parseQaReviewSummaryArgs(process.argv)
  if (!args.inputPath) {
    throw new Error(
      'Usage: tsx qaReviewSummary.ts --input <qa-review.csv> [--manifest <qa-review.manifest.json>] [--strict-manifest] [--strict-reviewed-rows] [--strict-reviewed-segments] [--next-review-limit 10] [--next-review-out <path>] [--min-reviewed 1] [--require-status LEGAL] [--require-bucket marked_space_park] [--min-reviewed-bucket marked_space_park=2] [--json] [--out <path>]',
    )
  }

  const summary = await qaReviewSummary({
    inputPath: args.inputPath,
    manifestPath: args.manifestPath,
    strictManifest: args.strictManifest,
    strictReviewedRows: args.strictReviewedRows,
    strictReviewedSegments: args.strictReviewedSegments,
    nextReviewRowsLimit: args.nextReviewRowsLimit,
    minReviewed: args.minReviewed,
    requireStatuses: args.requireStatuses,
    requireBuckets: args.requireBuckets,
    minReviewedBuckets: args.minReviewedBuckets,
  })
  const output = args.json
    ? `${JSON.stringify(summary, null, 2)}\n`
    : formatQaReviewSummary(summary)

  if (args.outPath) {
    const resolvedOutPath = path.resolve(args.outPath)
    await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true })
    await fs.writeFile(resolvedOutPath, output, 'utf-8')
  }
  if (args.nextReviewOutPath) {
    const resolvedNextReviewOutPath = path.resolve(args.nextReviewOutPath)
    await fs.mkdir(path.dirname(resolvedNextReviewOutPath), { recursive: true })
    await fs.writeFile(
      resolvedNextReviewOutPath,
      formatQaNextReviewRowsCsv(summary),
      'utf-8',
    )
  }
  process.stdout.write(output)

  if (!summary.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
