import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseGenerateBaselinesArgs } from './generateBaselineArgs'
import { loadGenerateBaselineEntries } from './generateBaselineRegistry'
import { runGenerateBaselineWorkflow } from './generateBaselineWorkflow'
import { createGenerateBaselineWorkflowDeps } from './generateBaselineWorkflowRuntime'

const run = async () => {
  const args = parseGenerateBaselinesArgs(process.argv)
  const generatedRoot = path.resolve(args.generatedRoot)
  const { entries } = await loadGenerateBaselineEntries({
    registryPath: path.join(generatedRoot, 'registry.json'),
    districtIdFilter: args.districtIdFilter,
  })
  const { skipped } = await runGenerateBaselineWorkflow(
    {
      args,
      entries,
      baselineDir: path.resolve('ops/baselines'),
    },
    createGenerateBaselineWorkflowDeps(generatedRoot),
  )

  if (skipped.length > 0) {
    throw new Error(
      `Baseline update refused for ${skipped.join(
        ', ',
      )}. Run npm run ops:baseline:seed to create missing baselines or ops:baseline:force to overwrite.`,
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
