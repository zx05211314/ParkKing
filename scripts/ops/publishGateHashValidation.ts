import { validatePublishGateHashEntry } from './publishGateHashEntryValidation'
import { getPublishGateMetaFiles } from './publishGateHashState'

export const validatePublishGateFileHashes = async (
  districtId: string,
  datasetDir: string,
  meta: Record<string, unknown>,
) => {
  const { files, warnings } = getPublishGateMetaFiles(districtId, meta)
  if (!files) {
    return warnings
  }

  for (const [fileName, entry] of Object.entries(files)) {
    warnings.push(
      ...(await validatePublishGateHashEntry({
        districtId,
        datasetDir,
        fileName,
        entry,
      })),
    )
  }

  return warnings
}
