import { fileURLToPath } from 'node:url'
import { parseP0ReadinessArgs } from './p0ReadinessArgs'
import { formatP0Readiness } from './p0ReadinessOutput'
import { buildP0Readiness } from './p0ReadinessState'
import type { P0ReadinessParams } from './p0ReadinessTypes'

export const p0Readiness = async (params: P0ReadinessParams = {}) =>
  buildP0Readiness(params)

const run = async () => {
  const args = parseP0ReadinessArgs(process.argv)
  const result = await p0Readiness({
    districtId: args.districtId,
    datasetDir: args.datasetDir,
    reviewPath: args.reviewPath,
    manifestPath: args.manifestPath,
    configPath: args.configPath,
    publishReportPath: args.publishReportPath,
    answerCasesPath: args.answerCasesPath,
    hhmm: args.hhmm,
    searchRadiusMeters: args.searchRadiusMeters,
    nextReviewRowsLimit: args.nextReviewRowsLimit,
    allowPublishWarn: args.allowPublishWarn,
    allowPublishFail: args.allowPublishFail,
    publishOverrideReason: args.publishOverrideReason,
  })
  const output = args.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatP0Readiness(result)}\n`
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
