import * as path from 'node:path'
import {
  fileExists,
  hashFile,
} from './publishGateFiles'
import type { GateWarning } from './publishGateTypes'

export const validatePublishGateHashEntry = async (params: {
  districtId: string
  datasetDir: string
  fileName: string
  entry: { sha256?: string; bytes?: number } | undefined
}) => {
  const warnings: GateWarning[] = []
  const target = path.resolve(params.datasetDir, params.fileName)
  if (!(await fileExists(target))) {
    warnings.push({
      severity: 'FAIL',
      code: 'FILE_MISSING',
      message: `${params.fileName} missing on disk for ${params.districtId}`,
    })
    return warnings
  }

  try {
    const actual = await hashFile(target)
    if (params.entry?.sha256 && params.entry.sha256 !== actual.sha256) {
      warnings.push({
        severity: 'FAIL',
        code: 'HASH_MISMATCH',
        message: `sha256 mismatch for ${params.fileName} (${params.districtId})`,
      })
    }
    if (typeof params.entry?.bytes === 'number' && params.entry.bytes !== actual.bytes) {
      warnings.push({
        severity: 'FAIL',
        code: 'BYTES_MISMATCH',
        message: `byte size mismatch for ${params.fileName} (${params.districtId})`,
      })
    }
  } catch {
    warnings.push({
      severity: 'FAIL',
      code: 'HASH_READ_FAILED',
      message: `hash verification failed for ${params.fileName} (${params.districtId})`,
    })
  }

  return warnings
}
