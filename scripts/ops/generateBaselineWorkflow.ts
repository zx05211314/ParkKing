import * as path from 'node:path'
import { runGenerateBaselineEntryWorkflow } from './generateBaselineEntryWorkflow'
import { defaultGenerateBaselineWorkflowDeps } from './generateBaselineWorkflowRuntime'
import type {
  GenerateBaselineWorkflowDeps,
  GenerateBaselineWorkflowOptions,
  GenerateBaselineWorkflowResult,
} from './generateBaselineWorkflowTypes'

export const runGenerateBaselineWorkflow = async (
  options: GenerateBaselineWorkflowOptions,
  deps: GenerateBaselineWorkflowDeps = defaultGenerateBaselineWorkflowDeps,
): Promise<GenerateBaselineWorkflowResult> => {
  const baselineDir = path.resolve(options.baselineDir ?? 'ops/baselines')
  await deps.ensureDir(baselineDir)

  const skipped: string[] = []
  const written: string[] = []

  for (const entry of options.entries) {
    const result = await runGenerateBaselineEntryWorkflow({
      args: options.args,
      entry,
      baselineDir,
      deps,
    })
    if (result.status === 'written') {
      written.push(result.districtId)
      continue
    }
    skipped.push(result.districtId)
  }

  return {
    skipped,
    written,
  }
}

export { resolveGenerateBaselineOutputAction } from './generateBaselineEntryWorkflow'
export type {
  GenerateBaselineEntryResult,
  GenerateBaselineMetaPayload,
  GenerateBaselineWorkflowDeps,
  GenerateBaselineWorkflowOptions,
  GenerateBaselineWorkflowResult,
} from './generateBaselineWorkflowTypes'
