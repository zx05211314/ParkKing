import * as path from 'node:path'
import { buildBaselineRecord } from './generateBaselineMetrics'
import type {
  GenerateBaselineEntryResult,
  GenerateBaselineWorkflowDeps,
} from './generateBaselineWorkflowTypes'
import type { GenerateBaselinesArgs, RegistryEntry } from './generateBaselineTypes'

export const resolveGenerateBaselineOutputAction = (params: {
  outputExists: boolean
  force: boolean
  seed: boolean
}) => {
  if (params.outputExists) {
    return params.force ? 'write' : 'skip-existing'
  }
  return params.seed || params.force ? 'write' : 'skip-missing'
}

export const runGenerateBaselineEntryWorkflow = async (params: {
  args: GenerateBaselinesArgs
  entry: RegistryEntry
  baselineDir: string
  deps: GenerateBaselineWorkflowDeps
}): Promise<GenerateBaselineEntryResult> => {
  const outputPath = path.resolve(params.baselineDir, `${params.entry.districtId}.json`)
  const action = resolveGenerateBaselineOutputAction({
    outputExists: await params.deps.outputExists(outputPath),
    force: params.args.force,
    seed: params.args.seed,
  })

  if (action === 'skip-existing') {
    params.deps.log(
      `Baseline exists for ${params.entry.districtId}. Re-run with --force to overwrite.`,
    )
    return {
      status: 'skipped',
      districtId: params.entry.districtId,
    }
  }

  if (action === 'skip-missing') {
    params.deps.log(
      `Baseline missing for ${params.entry.districtId}. Re-run with --seed to create.`,
    )
    return {
      status: 'skipped',
      districtId: params.entry.districtId,
    }
  }

  const datasetDir = await params.deps.findDatasetDir(params.entry.districtId)
  const { meta, metaRaw } = await params.deps.readDatasetMeta(datasetDir)
  const day = await params.deps.runMedianBench(datasetDir, '13:00')
  const night = await params.deps.runMedianBench(datasetDir, '21:00')
  const baseline = buildBaselineRecord({
    entry: params.entry,
    meta,
    metaRaw,
    day,
    night,
  })

  await params.deps.writeBaseline(outputPath, baseline)
  params.deps.log(`Wrote baseline ${outputPath}`)

  return {
    status: 'written',
    districtId: params.entry.districtId,
  }
}
