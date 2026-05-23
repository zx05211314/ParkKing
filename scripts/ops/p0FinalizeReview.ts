import { fileURLToPath } from 'node:url'
import { parseP0FinalizeReviewArgs } from './p0FinalizeReviewArgs'
import { formatP0FinalizeReview } from './p0FinalizeReviewOutput'
import { buildP0FinalizeReview } from './p0FinalizeReviewState'
import type { P0FinalizeReviewParams } from './p0FinalizeReviewTypes'

export const p0FinalizeReview = async (params: P0FinalizeReviewParams = {}) =>
  buildP0FinalizeReview(params)

const run = async () => {
  const args = parseP0FinalizeReviewArgs(process.argv)
  const result = await p0FinalizeReview({
    districtId: args.districtId,
    sourcePath: args.sourcePath,
    reviewsPath: args.reviewsPath,
    mergedOutPath: args.mergedOutPath,
    configPath: args.configPath,
    answerCasesPath: args.answerCasesPath,
    outDir: args.outDir,
    publishReportPath: args.publishReportPath,
    noCleanup: args.noCleanup,
    allowPublishWarn: args.allowPublishWarn,
    allowPublishFail: args.allowPublishFail,
    publishOverrideReason: args.publishOverrideReason,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatP0FinalizeReview(result)}\n`
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
