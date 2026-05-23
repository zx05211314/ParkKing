import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileExists } from './publishGateFiles'
import type { GateWarning } from './publishGateTypes'

export const readPublishGateJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export const loadPublishGateDatasetMeta = async (
  districtId: string,
  datasetDir: string,
) => {
  const metaPath = path.resolve(datasetDir, 'dataset_meta.json')
  if (!(await fileExists(metaPath))) {
    return {
      meta: null,
      warnings: [
        {
          severity: 'FAIL',
          code: 'META_MISSING',
          message: `dataset_meta.json missing for ${districtId}`,
        } satisfies GateWarning,
      ],
    }
  }

  try {
    return {
      meta: await readPublishGateJson<Record<string, unknown>>(metaPath),
      warnings: [] as GateWarning[],
    }
  } catch {
    return {
      meta: null,
      warnings: [
        {
          severity: 'FAIL',
          code: 'META_UNREADABLE',
          message: `dataset_meta.json unreadable for ${districtId}`,
        } satisfies GateWarning,
      ],
    }
  }
}
