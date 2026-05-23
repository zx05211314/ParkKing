import { fileURLToPath } from 'node:url'
import { parseQaReviewGeojsonArgs } from './qaReviewGeojsonArgs'
import { formatQaReviewGeojson } from './qaReviewGeojsonOutput'
import { buildQaReviewGeojson } from './qaReviewGeojsonState'
import type { QaReviewGeojsonParams } from './qaReviewGeojsonTypes'

export const qaReviewGeojson = async (params: QaReviewGeojsonParams) =>
  buildQaReviewGeojson(params)

const run = async () => {
  const args = parseQaReviewGeojsonArgs(process.argv)
  if (!args.inputPath) {
    throw new Error(
      'Usage: tsx qaReviewGeojson.ts --input <next-review.csv> [--out <review-points.geojson>] [--json]',
    )
  }

  const result = await qaReviewGeojson({
    inputPath: args.inputPath,
    outPath: args.outPath,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatQaReviewGeojson(result)}\n`

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
