import { PACK_FILES } from '../ingest/hashFiles'
import type { GateWarning } from './publishGateTypes'

export const getPublishGateMetaFiles = (
  districtId: string,
  meta: Record<string, unknown>,
) => {
  const files = meta.files as Record<string, { sha256?: string; bytes?: number }> | undefined
  if (!files || typeof files !== 'object') {
    return {
      files: null,
      warnings: [
        {
          severity: 'FAIL',
          code: 'META_FILES_MISSING',
          message: `files map missing in dataset_meta for ${districtId}`,
        } satisfies GateWarning,
      ],
    }
  }

  const warnings: GateWarning[] = []
  PACK_FILES.required.forEach((fileName) => {
    if (!files[fileName]) {
      warnings.push({
        severity: 'FAIL',
        code: 'META_FILE_ENTRY_MISSING',
        message: `files.${fileName} missing in dataset_meta for ${districtId}`,
      })
    }
  })

  return {
    files,
    warnings,
  }
}
