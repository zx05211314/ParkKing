import { DEFAULT_DATASET_ROOTS } from './sampleQaCandidateTypes'
import {
  resolveDistrictDatasetDir,
} from './sampleQaCandidateDataset'
import { loadQaCandidateOptionalLayers } from './sampleQaCandidateOptionalLayers'
import { loadQaCandidateRequiredLayers } from './sampleQaCandidateRequiredLayers'
import type { QaCandidateDatasetBundle } from './sampleQaCandidateDataTypes'

export const loadQaCandidateDataset = async (params: {
  districtId: string
  datasetRoots?: string[]
}): Promise<QaCandidateDatasetBundle> => {
  const datasetRoots = params.datasetRoots ?? DEFAULT_DATASET_ROOTS
  const baseDir = await resolveDistrictDatasetDir(params.districtId, datasetRoots)
  if (!baseDir) {
    throw new Error(
      `Could not locate latest pack/generated directory for district ${params.districtId}`,
    )
  }

  const [requiredLayers, optionalLayers] = await Promise.all([
    loadQaCandidateRequiredLayers(baseDir),
    loadQaCandidateOptionalLayers(baseDir),
  ])

  return {
    baseDir,
    ...requiredLayers,
    ...optionalLayers,
  }
}
