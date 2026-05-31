import type { Dispatch, SetStateAction } from 'react'
import type { DatasetMeta } from '../data/segmentBuilder'
import type { ParkingSpaceCollection } from '../data/parkingSpaces'
import type { Zone } from '../domain/zones/zoneTypes'
import type { Segment } from './types'
import type {
  DatasetManifest,
  IngestReport,
  LatestPointer,
} from './datasetInfo/model'

export interface DatasetOption {
  id: string
  label: string
}

export interface UseDatasetLoadEffectsOptions {
  datasetId: string | null
  setDatasetOptions: Dispatch<SetStateAction<DatasetOption[]>>
  setDatasetId: Dispatch<SetStateAction<string | null>>
  setDatasetStatus: Dispatch<SetStateAction<'loading' | 'ready' | 'error'>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setSegments: Dispatch<SetStateAction<Segment[]>>
  setParkingSpaces: Dispatch<SetStateAction<ParkingSpaceCollection>>
  setZones: Dispatch<SetStateAction<Zone[]>>
  setParkingSpaceCount: Dispatch<SetStateAction<number>>
  setIntersectionCount: Dispatch<SetStateAction<number>>
  setCrosswalkCount: Dispatch<SetStateAction<number>>
  setOverrideCount: Dispatch<SetStateAction<number>>
  setInferredCount: Dispatch<SetStateAction<number>>
  setDatasetMeta: Dispatch<SetStateAction<DatasetMeta | null>>
  setLatestInfo: Dispatch<SetStateAction<LatestPointer | null>>
  setManifestInfo: Dispatch<SetStateAction<DatasetManifest | null>>
  setIngestReport: Dispatch<SetStateAction<IngestReport | null>>
  setMetricsHistory: Dispatch<SetStateAction<string | null>>
  setPackError: Dispatch<SetStateAction<string | null>>
}
