import { loadPublishGateDatasetValidationContext } from './publishGateDatasetValidationContext'
import { validateReadyPublishGateDataset } from './publishGateDatasetValidationRules'

export const validateDatasetPack = async (
  districtId: string,
  datasetRootDir?: string,
  publishedRootDir?: string | null,
  strictDiff?: boolean,
)=>
  loadPublishGateDatasetValidationContext(districtId, datasetRootDir).then(
    async (context) =>
      context.status === 'ready'
        ? [
            ...context.warnings,
            ...(await validateReadyPublishGateDataset({
              districtId,
              datasetDir: context.datasetDir,
              meta: context.meta,
              publishedRootDir,
              strictDiff,
            })),
          ]
        : context.warnings,
  )
