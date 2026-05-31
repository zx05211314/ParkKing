import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseQaReviewChecklistArgs } from './qaReviewChecklistArgs'
import { formatQaReviewChecklist } from './qaReviewChecklistOutput'
import { buildQaReviewChecklist } from './qaReviewChecklistState'
import type { QaReviewChecklistParams } from './qaReviewChecklistTypes'

export const qaReviewChecklist = async (params: QaReviewChecklistParams) =>
  buildQaReviewChecklist(params)

const run = async () => {
  const args = parseQaReviewChecklistArgs(process.argv)
  if (!args.inputPath) {
    throw new Error(
      'Usage: tsx qaReviewChecklist.ts --input <next-review.csv> [--source <qa-review.csv>] [--out <checklist.md>] [--merged-out <merged-review.csv>] [--config <config.json>] [--title <title>] [--json]',
    )
  }

  const result = await qaReviewChecklist({
    inputPath: args.inputPath,
    sourcePath: args.sourcePath,
    outPath: args.outPath,
    mergedOutPath: args.mergedOutPath,
    configPath: args.configPath,
    title: args.title,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatQaReviewChecklist(result)}\n`

  if (args.outPath) {
    const resolvedOutPath = path.resolve(args.outPath)
    await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true })
    await fs.writeFile(resolvedOutPath, output, 'utf-8')
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
