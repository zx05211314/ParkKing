import { fileURLToPath } from 'node:url'
import { parseP0PrepareReviewArgs } from './p0PrepareReviewArgs'
import { formatP0PrepareReview } from './p0PrepareReviewOutput'
import { buildP0PrepareReview } from './p0PrepareReviewState'
import type { P0PrepareReviewParams } from './p0PrepareReviewTypes'

export const p0PrepareReview = async (params: P0PrepareReviewParams = {}) =>
  buildP0PrepareReview(params)

const run = async () => {
  const args = parseP0PrepareReviewArgs(process.argv)
  const result = await p0PrepareReview({
    districtId: args.districtId,
    sourcePath: args.sourcePath,
    manifestPath: args.manifestPath,
    configPath: args.configPath,
    nextReviewOutPath: args.nextReviewOutPath,
    checklistOutPath: args.checklistOutPath,
    geojsonOutPath: args.geojsonOutPath,
    mergedOutPath: args.mergedOutPath,
    nextReviewRowsLimit: args.nextReviewRowsLimit,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatP0PrepareReview(result)}\n`

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
