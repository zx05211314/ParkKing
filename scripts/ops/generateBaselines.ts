import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseGenerateBaselinesArgs } from './generateBaselineArgs'
import { loadGenerateBaselineEntries } from './generateBaselineRegistry'
import { runGenerateBaselineWorkflow } from './generateBaselineWorkflow'

const run = async () => {
  const args = parseGenerateBaselinesArgs(process.argv)
  const { entries } = await loadGenerateBaselineEntries({
    registryPath: path.resolve('public/data/generated/registry.json'),
    districtIdFilter: args.districtIdFilter,
  })
  const { skipped } = await runGenerateBaselineWorkflow({
    args,
    entries,
    baselineDir: path.resolve('ops/baselines'),
  })

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
