import {
  loadPublishGateDatasetMeta,
  resolvePublishGateDatasetDir,
  validatePublishGateRequiredFiles,
} from './publishGatePackMetadata'
import type { GateWarning } from './publishGateTypes'

export type PublishGateDatasetValidationContext =
  | {
      status: 'invalid'
      warnings: GateWarning[]
    }
  | {
      status: 'missing-pack'
      warnings: GateWarning[]
    }
  | {
      status: 'missing-meta'
      datasetDir: string
      warnings: GateWarning[]
    }
  | {
      status: 'ready'
      datasetDir: string
      meta: Record<string, unknown>
      warnings: GateWarning[]
    }

export const loadPublishGateDatasetValidationContext = async (
  districtId: string,
  datasetRootDir?: string,
): Promise<PublishGateDatasetValidationContext> => {
  if (!districtId || districtId === 'unknown') {
    return {
      status: 'invalid',
      warnings: [
        {
          severity: 'FAIL',
          code: 'DISTRICT_ID_MISSING',
          message: 'districtId missing from ingest report',
        },
      ],
    }
  }

  const datasetDir = await resolvePublishGateDatasetDir(districtId, datasetRootDir)
  if (!datasetDir) {
    return {
      status: 'missing-pack',
      warnings: [
        {
          severity: 'FAIL',
          code: 'PACK_MISSING',
          message: `No dataset directory found for ${districtId}`,
        },
      ],
    }
  }

  const warnings = await validatePublishGateRequiredFiles(districtId, datasetDir)
  const { meta, warnings: metaLoadWarnings } = await loadPublishGateDatasetMeta(
    districtId,
    datasetDir,
  )
  warnings.push(...metaLoadWarnings)

  if (!meta) {
    return {
      status: 'missing-meta',
      datasetDir,
      warnings,
    }
  }

  const metaDistrictId = meta.districtId as string | undefined
  if (metaDistrictId && metaDistrictId !== districtId) {
    warnings.push({
      severity: 'FAIL',
      code: 'META_DISTRICT_MISMATCH',
      message: `meta districtId ${metaDistrictId} does not match folder ${districtId}`,
    })
  }

  return {
    status: 'ready',
    datasetDir,
    meta,
    warnings,
  }
}
