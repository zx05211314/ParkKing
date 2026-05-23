import { fileURLToPath } from 'node:url'
import { parseP0PromoteReviewArgs } from './p0PromoteReviewArgs'
import { formatP0PromoteReview } from './p0PromoteReviewOutput'
import { buildP0PromoteReview } from './p0PromoteReviewState'
import type { P0PromoteReviewParams } from './p0PromoteReviewTypes'

export const p0PromoteReview = async (params: P0PromoteReviewParams = {}) =>
  buildP0PromoteReview(params)

const run = async () => {
  const args = parseP0PromoteReviewArgs(process.argv)
  const result = await p0PromoteReview({
    districtId: args.districtId,
    sourcePath: args.sourcePath,
    reviewsPath: args.reviewsPath,
    mergedOutPath: args.mergedOutPath,
    configPath: args.configPath,
    outDir: args.outDir,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatP0PromoteReview(result)}\n`
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
