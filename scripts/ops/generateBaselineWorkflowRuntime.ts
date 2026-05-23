import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { findBaselineDatasetDir } from './generateBaselineFiles'
import { runMedianBench } from './generateBaselineMetrics'
import type { GenerateBaselineWorkflowDeps } from './generateBaselineWorkflowTypes'

export const defaultGenerateBaselineWorkflowDeps: GenerateBaselineWorkflowDeps = {
  ensureDir: async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true })
  },
  outputExists: async (filePath) => {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  },
  findDatasetDir: findBaselineDatasetDir,
  readDatasetMeta: async (datasetDir) => {
    const metaPath = path.resolve(datasetDir, 'dataset_meta.json')
    const metaRaw = await fs.readFile(metaPath, 'utf-8')
    return {
      meta: JSON.parse(metaRaw) as Record<string, unknown>,
      metaRaw,
    }
  },
  runMedianBench,
  writeBaseline: async (filePath, baseline) => {
    await fs.writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf-8')
  },
  log: (message) => {
    console.log(message)
  },
}
