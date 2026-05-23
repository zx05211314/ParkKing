import { fileURLToPath } from 'node:url'
import { parsePublishGateArgs } from './publishGateArgs'
import { buildPublishGateOptionsFromArgs } from './publishGateCliOptions'
import { loadPublishGateExecutionState } from './publishGateExecutionState'
import {
  buildPublishGateRunSummary,
  writePublishGateArtifacts,
} from './publishGateOutputs'
import type {
  PublishGateOptions,
  PublishGateResult,
} from './publishGateTypes'
export type {
  GateWarning,
  PublishGateOptions,
  PublishGateResult,
  Severity,
} from './publishGateTypes'

export const runPublishGate = async (
  options: PublishGateOptions,
): Promise<PublishGateResult> => {
  const {
    runtime,
    bootstrapState,
    baselineAdoptState,
    districtSummaries,
    totals,
    exitCode,
  } = await loadPublishGateExecutionState(options)

  const summary = buildPublishGateRunSummary({
    reportPath: runtime.reportPath,
    mode: runtime.mode,
    allowWarn: runtime.allowWarn,
    allowFailRequested: runtime.allowFail,
    allowBaselineAdopt: runtime.allowBaselineAdopt,
    overrideReason: runtime.overrideReason,
    bootstrapState,
    baselineAdoptState,
    totals,
    districts: districtSummaries,
    exitCode,
  })

  await writePublishGateArtifacts({
    outputDir: runtime.outputDir,
    summary,
  })

  return { exitCode, summary }
}

const run = async () => {
  const args = parsePublishGateArgs(process.argv)
  const result = await runPublishGate(buildPublishGateOptionsFromArgs(args))
  process.exit(result.exitCode)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
