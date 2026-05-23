import * as path from 'node:path'
import { PACK_FILES } from '../ingest/hashFiles'
import { fileExists } from './publishGateFiles'
import type { GateWarning } from './publishGateTypes'

export const validatePublishGateRequiredFiles = async (
  districtId: string,
  datasetDir: string,
) => {
  const warnings: GateWarning[] = []
  const requiredFiles = [...PACK_FILES.required, 'dataset_meta.json']

  for (const fileName of requiredFiles) {
    const target = path.resolve(datasetDir, fileName)
    if (!(await fileExists(target))) {
      warnings.push({
        severity: 'FAIL',
        code: 'FILE_MISSING',
        message: `${fileName} missing for ${districtId}`,
      })
    }
  }

  return warnings
}
