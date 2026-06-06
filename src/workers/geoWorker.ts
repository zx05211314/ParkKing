import type { EvaluatedSegment, Segment } from '../ui/types'
import { getClipCacheStats, resetClipCacheStats } from '../domain/geometry/clipCache'
import { evaluateSegmentWithZones } from '../domain/rules/evaluateSegment'
import { getZoneIndex, type ZoneIndex } from '../domain/zones/zoneIndex'
import type { Zone } from '../domain/zones/zoneTypes'
import type {
  WorkerEvaluatePayload,
  WorkerInitPayload,
  WorkerMessage,
} from './protocol'

let cachedSegments: Segment[] = []
let cachedZones: Zone[] = []
let cachedHash = 'local'
let cachedParamsVersion = 'default'
let zoneIndex: ZoneIndex | null = null
let degradedEvaluationOnly = false

const evaluateAll = (nowHHMM: string): EvaluatedSegment[] => {
  return cachedSegments.flatMap((segment) =>
    evaluateSegmentWithZones(segment, nowHHMM, zoneIndex),
  )
}

const evaluateBase = (nowHHMM: string): EvaluatedSegment[] => {
  return cachedSegments.flatMap((segment) =>
    evaluateSegmentWithZones(segment, nowHHMM, null),
  )
}

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data as WorkerMessage

  if (type === 'init') {
    const initPayload = payload as WorkerInitPayload
    cachedSegments = initPayload.segments
    cachedZones = initPayload.zones
    cachedHash = initPayload.datasetHash || 'local'
    cachedParamsVersion = initPayload.zoneParamsVersion || 'default'
    resetClipCacheStats()
    degradedEvaluationOnly = initPayload.degradedEvaluationOnly === true
    zoneIndex = cachedZones.length && !degradedEvaluationOnly
      ? getZoneIndex(cachedZones, cachedHash, cachedParamsVersion)
      : null

    self.postMessage({ type: 'init-complete' })
    return
  }

  if (type === 'evaluate') {
    const evalPayload = payload as WorkerEvaluatePayload
    if (!cachedSegments.length) {
      self.postMessage({ type: 'error', message: 'No segments loaded' })
      return
    }

    if (degradedEvaluationOnly) {
      const evaluated = evaluateBase(evalPayload.nowHHMM)
      self.postMessage({
        type: 'evaluated',
        payload: {
          segments: evaluated,
          requestId: evalPayload.requestId,
          cacheStats: getClipCacheStats(),
          degraded: true,
        },
      })
      return
    }

    const evaluated = evaluateAll(evalPayload.nowHHMM)
    const cacheStats = getClipCacheStats()
    self.postMessage({
      type: 'evaluated',
      payload: {
        segments: evaluated,
        requestId: evalPayload.requestId,
        cacheStats,
      },
    })
  }
}
