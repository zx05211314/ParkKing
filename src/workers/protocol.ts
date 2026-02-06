import type { ClipCacheStats } from '../domain/geometry/clipCache'
import type { Zone } from '../domain/zones/zoneTypes'
import type { EvaluatedSegment, Segment } from '../ui/types'

export interface WorkerInitPayload {
  segments: Segment[]
  zones: Zone[]
  datasetHash: string
  zoneParamsVersion: string
}

export interface WorkerEvaluatePayload {
  nowHHMM: string
  requestId: number
}

export interface WorkerEvaluatedPayload {
  segments: EvaluatedSegment[]
  requestId: number
  cacheStats?: ClipCacheStats
}

export type WorkerMessage =
  | { type: 'init'; payload: WorkerInitPayload }
  | { type: 'evaluate'; payload: WorkerEvaluatePayload }

export type WorkerResponse =
  | { type: 'init-complete' }
  | { type: 'evaluated'; payload: WorkerEvaluatedPayload }
  | { type: 'error'; message: string }
