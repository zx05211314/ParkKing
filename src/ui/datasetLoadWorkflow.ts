import { getDatasetBaseDir } from '../data/datasetResolver'
import {
  validateFileSet,
  validateMeta,
  verifyPackHashes,
} from '../data/districtPack'
import {
  loadDatasetArtifacts,
  loadDatasetSupplementalInfo,
  verifyLatestDatasetHash,
  type DatasetSupplementalInfo,
} from './datasetLoadArtifacts'
import type { UseDatasetLoadEffectsOptions } from './datasetLoadEffectTypes'
import {
  applyDatasetLoadResult,
  applyDatasetSupplementalInfo,
} from './datasetLoadState'
import { buildDatasetLoadResult, type DatasetLoadResult } from './datasetLoadResult'
import { loadDatasetRegistryOptions } from './datasetRegistryLoader'

type DatasetRegistrySetters = Pick<
  UseDatasetLoadEffectsOptions,
  'setDatasetOptions' | 'setDatasetId'
>

type DatasetLoadApplySetters = Pick<
  UseDatasetLoadEffectsOptions,
  | 'setSegments'
  | 'setParkingSpaces'
  | 'setZones'
  | 'setParkingSpaceCount'
  | 'setIntersectionCount'
  | 'setCrosswalkCount'
  | 'setOverrideCount'
  | 'setInferredCount'
  | 'setDatasetMeta'
  | 'setDatasetStatus'
  | 'setLatestInfo'
  | 'setManifestInfo'
  | 'setIngestReport'
  | 'setMetricsHistory'
>

export interface LoadedDatasetState {
  supplementalInfo: DatasetSupplementalInfo
  datasetLoadResult: DatasetLoadResult
}

export const shouldVerifyDatasetHashes = (env?: Record<string, string>) =>
  env?.VITE_VERIFY_HASHES === '1'

export const loadDatasetRegistryState = async (
  datasetId: string | null,
  { setDatasetOptions, setDatasetId }: DatasetRegistrySetters,
) => {
  const result = await loadDatasetRegistryOptions(datasetId)
  if (!result) {
    return
  }

  setDatasetOptions(result.options)
  if (result.nextDatasetId !== datasetId) {
    setDatasetId(result.nextDatasetId)
  }
}

export const loadDatasetState = async (
  datasetId: string,
  env = (import.meta as { env?: Record<string, string> }).env,
): Promise<LoadedDatasetState> => {
  const fileCheck = await validateFileSet(datasetId)
  if (!fileCheck.valid) {
    throw new Error(fileCheck.errors.join('\n'))
  }

  const baseDir = getDatasetBaseDir(datasetId)
  const {
    redYellow,
    busStops,
    hydrants,
    parkingSpaces,
    intersections,
    crosswalks,
    signOverrides,
    inferredCandidates,
    meta,
  } = await loadDatasetArtifacts(baseDir)

  if (!meta) {
    throw new Error('dataset_meta.json missing or unreadable')
  }

  const metaCheck = validateMeta(meta)
  if (!metaCheck.valid) {
    throw new Error(metaCheck.errors.join('\n'))
  }

  const verifyHashes = shouldVerifyDatasetHashes(env)
  if (verifyHashes && meta.files) {
    const hashCheck = await verifyPackHashes(baseDir, meta.files)
    if (!hashCheck.valid) {
      throw new Error(`Pack integrity failure:\n${hashCheck.errors.join('\n')}`)
    }
  }

  if (verifyHashes) {
    await verifyLatestDatasetHash(baseDir, meta.datasetHash)
  }

  const supplementalInfo = await loadDatasetSupplementalInfo(baseDir, datasetId)

  return {
    supplementalInfo,
    datasetLoadResult: buildDatasetLoadResult({
      redYellow,
      busStops,
      hydrants,
      parkingSpaces,
      intersections,
      crosswalks,
      signOverrides,
      inferredCandidates,
      meta,
    }),
  }
}

export const applyLoadedDatasetState = (
  {
    setLatestInfo,
    setManifestInfo,
    setIngestReport,
    setMetricsHistory,
    setSegments,
    setParkingSpaces,
    setZones,
    setParkingSpaceCount,
    setIntersectionCount,
    setCrosswalkCount,
    setOverrideCount,
    setInferredCount,
    setDatasetMeta,
    setDatasetStatus,
  }: DatasetLoadApplySetters,
  { supplementalInfo, datasetLoadResult }: LoadedDatasetState,
) => {
  applyDatasetSupplementalInfo(
    {
      setLatestInfo,
      setManifestInfo,
      setIngestReport,
      setMetricsHistory,
    },
    supplementalInfo,
  )
  applyDatasetLoadResult(
    {
      setSegments,
      setParkingSpaces,
      setZones,
      setParkingSpaceCount,
      setIntersectionCount,
      setCrosswalkCount,
      setOverrideCount,
      setInferredCount,
      setDatasetMeta,
      setDatasetStatus,
    },
    datasetLoadResult,
  )
}
