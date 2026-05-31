import * as path from 'node:path'
import type { IngestAllArgs } from './ingestAllArgs'
import { runPublishGate } from '../ops/publishGate'

export const runIngestAllGate = async (params: {
  reportPath: string
  publicReportPath: string
  args: Pick<IngestAllArgs, 'allowWarn' | 'allowFail' | 'overrideReason' | 'dryRun'>
  cwd?: string
}) => {
  const cwd = params.cwd ?? process.cwd()
  const gateResult = await runPublishGate({
    reportPath: params.args.dryRun ? params.reportPath : params.publicReportPath,
    mode: 'strict',
    allowWarn: params.args.allowWarn,
    allowFail: params.args.allowFail,
    overrideReason: params.args.overrideReason ?? undefined,
    outputDir: params.args.dryRun ? path.resolve(cwd, 'data/generated') : undefined,
    datasetRootDir: path.resolve(cwd, 'data/generated'),
    publishedRootDir: path.resolve(cwd, 'public/data/generated'),
  })

  if (gateResult.exitCode !== 0) {
    throw new Error(`Publish gate failed with exit code ${gateResult.exitCode}`)
  }
}
