import * as path from 'node:path'
import { validateConfigPath } from './validateConfigPaths'

const validateOutputDir = (
  outputs: Record<string, unknown> | undefined,
  field: string,
  districtId: string | undefined,
  allowAbsolute: boolean,
  errors: string[],
  warnings: string[],
) => {
  const value = outputs?.[field]
  if (!value) {
    return
  }
  if (typeof value !== 'string') {
    errors.push(`outputs.${field} must be a string path`)
    return
  }
  validateConfigPath(value, allowAbsolute, errors, `outputs.${field}`)
  if (districtId) {
    const normalized = path.normalize(value)
    if (!normalized.endsWith(`${path.sep}${districtId}`)) {
      errors.push(`outputs.${field} must end with /${districtId}`)
    }
  } else {
    warnings.push(`outputs.${field} cannot be checked without districtId`)
  }
}

export const validateConfigOutputs = (
  outputs: Record<string, unknown> | undefined,
  districtId: string | undefined,
  allowAbsolute: boolean,
  errors: string[],
  warnings: string[],
) => {
  const outputsDistrictId = outputs?.districtId as string | undefined
  if (outputsDistrictId && districtId && outputsDistrictId !== districtId) {
    errors.push('outputs.districtId must match districtId')
  }

  validateOutputDir(outputs, 'generatedDir', districtId, allowAbsolute, errors, warnings)
  validateOutputDir(outputs, 'publicDir', districtId, allowAbsolute, errors, warnings)
}
