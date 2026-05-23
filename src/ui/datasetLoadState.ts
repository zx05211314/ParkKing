import type { UseDatasetLoadEffectsOptions } from './datasetLoadEffectTypes'
import type { DatasetSupplementalInfo } from './datasetLoadArtifacts'
import type { DatasetLoadResult } from './datasetLoadResult'

type DatasetLoadStateSetters = Pick<
  UseDatasetLoadEffectsOptions,
  | 'setDatasetStatus'
  | 'setSelectedId'
  | 'setSegments'
  | 'setParkingSpaces'
  | 'setZones'
  | 'setParkingSpaceCount'
  | 'setIntersectionCount'
  | 'setCrosswalkCount'
  | 'setOverrideCount'
  | 'setInferredCount'
  | 'setDatasetMeta'
  | 'setLatestInfo'
  | 'setManifestInfo'
  | 'setIngestReport'
  | 'setMetricsHistory'
  | 'setPackError'
>

type DatasetLoadSupplementalInfoSetters = Pick<
  UseDatasetLoadEffectsOptions,
  'setLatestInfo' | 'setManifestInfo' | 'setIngestReport' | 'setMetricsHistory'
>

type DatasetLoadResultSetters = Pick<
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
>

export const resetDatasetLoadState = ({
  setDatasetStatus,
  setSelectedId,
  setSegments,
  setParkingSpaces,
  setZones,
  setParkingSpaceCount,
  setIntersectionCount,
  setCrosswalkCount,
  setOverrideCount,
  setInferredCount,
  setDatasetMeta,
  setLatestInfo,
  setManifestInfo,
  setIngestReport,
  setMetricsHistory,
  setPackError,
}: DatasetLoadStateSetters) => {
  setDatasetStatus('loading')
  setSelectedId(null)
  setSegments([])
  setParkingSpaces({ type: 'FeatureCollection', features: [] })
  setZones([])
  setParkingSpaceCount(0)
  setIntersectionCount(0)
  setCrosswalkCount(0)
  setOverrideCount(0)
  setInferredCount(0)
  setDatasetMeta(null)
  setLatestInfo(null)
  setManifestInfo(null)
  setIngestReport(null)
  setMetricsHistory(null)
  setPackError(null)
}

export const applyDatasetSupplementalInfo = (
  { setLatestInfo, setManifestInfo, setIngestReport, setMetricsHistory }: DatasetLoadSupplementalInfoSetters,
  { latest, manifest, report, history }: DatasetSupplementalInfo,
) => {
  setLatestInfo(latest)
  setManifestInfo(manifest)
  setIngestReport(report)
  setMetricsHistory(history)
}

export const applyDatasetLoadResult = (
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
  }: DatasetLoadResultSetters,
  {
    segments,
    parkingSpaces,
    zones,
    parkingSpaceCount,
    intersectionCount,
    crosswalkCount,
    overrideCount,
    inferredCount,
    datasetMeta,
  }: DatasetLoadResult,
) => {
  setSegments(segments)
  setParkingSpaces(parkingSpaces)
  setZones(zones)
  setParkingSpaceCount(parkingSpaceCount)
  setIntersectionCount(intersectionCount)
  setCrosswalkCount(crosswalkCount)
  setOverrideCount(overrideCount)
  setInferredCount(inferredCount)
  setDatasetMeta(datasetMeta)
  setDatasetStatus('ready')
}
