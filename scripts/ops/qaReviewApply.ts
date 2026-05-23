import { fileURLToPath } from 'node:url'
import { parseQaReviewApplyArgs } from './qaReviewApplyArgs'
import { formatQaReviewApply } from './qaReviewApplyOutput'
import { applyQaReviewHandoff } from './qaReviewApplyState'
import type { QaReviewApplyParams } from './qaReviewApplyTypes'

export const qaReviewApply = async (params: QaReviewApplyParams) =>
  applyQaReviewHandoff(params)

const run = async () => {
  const args = parseQaReviewApplyArgs(process.argv)
  if (!args.sourcePath || !args.reviewsPath || !args.outPath) {
    throw new Error(
      'Usage: tsx qaReviewApply.ts --source <qa-review.csv> --reviews <next-review.csv> --out <merged-review.csv> [--allow-overwrite] [--json]',
    )
  }

  const result = await qaReviewApply({
    sourcePath: args.sourcePath,
    reviewsPath: args.reviewsPath,
    outPath: args.outPath,
    allowOverwrite: args.allowOverwrite,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatQaReviewApply(result)}\n`
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
