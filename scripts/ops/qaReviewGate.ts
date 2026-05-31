import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseQaReviewGateArgs } from './qaReviewGateArgs'
import { formatQaNextReviewRowsCsv } from './qaReviewSummaryOutput'
import { formatQaReviewGate } from './qaReviewGateOutput'
import { buildQaReviewGate } from './qaReviewGateState'
import type { QaReviewGateParams } from './qaReviewGateTypes'

export const qaReviewGate = async (params: QaReviewGateParams) =>
  buildQaReviewGate(params)

const run = async () => {
  const args = parseQaReviewGateArgs(process.argv)
  if (!args.inputPath || !args.configPath) {
    throw new Error(
      'Usage: tsx qaReviewGate.ts --input <qa-review.csv> --config <config.json> [--manifest <qa-review.manifest.json>] [--allow-manifest-warnings] [--allow-config-provenance-warnings] [--allow-invalid-reviewed-rows] [--allow-duplicate-reviewed-segments] [--next-review-limit 10] [--next-review-out <path>] [--outDir data/overrides] [--min-reviewed 1] [--require-status LEGAL] [--require-bucket marked_space_park] [--min-reviewed-bucket marked_space_park=2] [--json] [--out <path>]',
    )
  }

  const result = await qaReviewGate({
    inputPath: args.inputPath,
    manifestPath: args.manifestPath,
    configPath: args.configPath,
    outDir: args.outDir,
    strictManifest: args.strictManifest,
    strictConfigProvenance: args.strictConfigProvenance,
    strictReviewedRows: args.strictReviewedRows,
    strictReviewedSegments: args.strictReviewedSegments,
    nextReviewRowsLimit: args.nextReviewRowsLimit,
    minReviewed: args.minReviewed,
    requireStatuses: args.requireStatuses,
    requireBuckets: args.requireBuckets,
    minReviewedBuckets: args.minReviewedBuckets,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatQaReviewGate(result)}\n`

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
      formatQaNextReviewRowsCsv(result.summary),
      'utf-8',
    )
  }
  process.stdout.write(output)

  if (!result.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
