import type { GenerateBaselinesArgs, RegistryEntry } from './generateBaselineTypes'

export interface GenerateBaselineBenchResult {
  medianEvalFirstMs: number
  medianEvalSecondMs: number
  distribution: Record<string, number>
  reasonCodes: { coveragePct: number; counts: Record<string, number> }
  evaluatedCount: number
}

export interface GenerateBaselineWorkflowOptions {
  args: GenerateBaselinesArgs
  entries: RegistryEntry[]
  baselineDir?: string
}

export interface GenerateBaselineWorkflowResult {
  skipped: string[]
  written: string[]
}

export interface GenerateBaselineMetaPayload {
  meta: Record<string, unknown>
  metaRaw: string
}

export interface GenerateBaselineWorkflowDeps {
  ensureDir: (dirPath: string) => Promise<void>
  outputExists: (filePath: string) => Promise<boolean>
  findDatasetDir: (districtId: string) => Promise<string>
  readDatasetMeta: (datasetDir: string) => Promise<GenerateBaselineMetaPayload>
  runMedianBench: (datasetDir: string, hhmm: string) => Promise<GenerateBaselineBenchResult>
  writeBaseline: (filePath: string, baseline: unknown) => Promise<void>
  log: (message: string) => void
}

export interface GenerateBaselineEntryResult {
  status: 'skipped' | 'written'
  districtId: string
}
