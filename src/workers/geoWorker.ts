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

const evaluateAll = (nowHHMM: string): EvaluatedSegment[] => {
  return cachedSegments.flatMap((segment) =>
    evaluateSegmentWithZones(segment, nowHHMM, zoneIndex),
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
    zoneIndex = cachedZones.length
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
