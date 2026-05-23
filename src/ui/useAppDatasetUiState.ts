import { useState } from 'react'
import { type Zone } from '../domain/zones/zoneTypes'
import { type ParkingSpaceCollection } from '../data/parkingSpaces'
import { type DatasetMeta } from '../data/segmentBuilder'
import type { Segment } from './types'
import {
  type DatasetManifest,
  type IngestReport,
  type LatestPointer,
} from './datasetInfo/model'
import type { ShareStatus } from './appUiStateTypes'

export const useAppDatasetUiState = () => {
  const [segments, setSegments] = useState<Segment[]>([])
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpaceCollection>({
    type: 'FeatureCollection',
    features: [],
  })
  const [zones, setZones] = useState<Zone[]>([])
  const [parkingSpaceCount, setParkingSpaceCount] = useState(0)
  const [intersectionCount, setIntersectionCount] = useState(0)
  const [crosswalkCount, setCrosswalkCount] = useState(0)
  const [overrideCount, setOverrideCount] = useState(0)
  const [inferredCount, setInferredCount] = useState(0)
  const [datasetMeta, setDatasetMeta] = useState<DatasetMeta | null>(null)
  const [datasetStatus, setDatasetStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [packError, setPackError] = useState<string | null>(null)
  const [latestInfo, setLatestInfo] = useState<LatestPointer | null>(null)
  const [manifestInfo, setManifestInfo] = useState<DatasetManifest | null>(null)
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [reportVersion, setReportVersion] = useState(0)
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null)

  return {
    crosswalkCount,
    datasetMeta,
    datasetStatus,
    inferredCount,
    infoOpen,
    ingestReport,
    intersectionCount,
    latestInfo,
    manifestInfo,
    metricsHistory,
    overrideCount,
    packError,
    parkingSpaceCount,
    parkingSpaces,
    reportVersion,
    segments,
    setCrosswalkCount,
    setDatasetMeta,
    setDatasetStatus,
    setInferredCount,
    setInfoOpen,
    setIngestReport,
    setIntersectionCount,
    setLatestInfo,
    setManifestInfo,
    setMetricsHistory,
    setOverrideCount,
    setPackError,
    setParkingSpaceCount,
    setParkingSpaces,
    setReportVersion,
    setSegments,
    setShareStatus,
    setZones,
    shareStatus,
    zones,
  }
}
