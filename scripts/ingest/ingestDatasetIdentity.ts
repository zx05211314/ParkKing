import * as path from 'node:path'
import type { FileHashEntry } from './hashFiles'
import { hashFiles, PACK_FILE_LIST } from './hashFiles'
import { getBoundaryFileName } from './ingestDistrictPaths'
import { hashString } from './readConfigSourceFiles'

export const DATASET_HASH_SCHEMA_VERSION = 1

const RUNTIME_PACK_FILES = PACK_FILE_LIST.filter((fileName) =>
  fileName.endsWith('.geojson'),
)

export interface DatasetIdentity {
  datasetHash: string
  datasetHashSchemaVersion: typeof DATASET_HASH_SCHEMA_VERSION
  datasetHashFiles: Record<string, string>
}

export const buildDatasetIdentityFromHashes = (
  files: Record<string, FileHashEntry>,
): DatasetIdentity => {
  const datasetHashFiles = Object.fromEntries(
    Object.entries(files)
      .map(([fileName, entry]) => [fileName, entry.sha256] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  const datasetHash = hashString(
    JSON.stringify({
      schemaVersion: DATASET_HASH_SCHEMA_VERSION,
      files: datasetHashFiles,
    }),
  )

  return {
    datasetHash,
    datasetHashSchemaVersion: DATASET_HASH_SCHEMA_VERSION,
    datasetHashFiles,
  }
}

export const buildDatasetIdentity = async (
  generatedDir: string,
  districtId: string,
) => {
  const fileNames = [getBoundaryFileName(districtId), ...RUNTIME_PACK_FILES]
  const summary = await hashFiles(path.resolve(generatedDir), fileNames)
  return buildDatasetIdentityFromHashes(summary.files)
}
