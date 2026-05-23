import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import {
  type ClipCacheStats,
} from '../domain/geometry/clipCache'
import { ZONE_PARAMS_VERSION } from '../domain/zones/constants'
import type { ZoneIndex } from '../domain/zones/zoneIndex'
import type { Zone } from '../domain/zones/zoneTypes'
import { EvaluationWorkerClient } from '../workers/evaluationClient'
import type { EvaluatedSegment, Segment } from './types'

export type SegmentEvaluationStatus =
  | 'idle'
  | 'working'
  | 'ready'
  | 'degraded'
  | 'error'

const WORKER_EVALUATION_TIMEOUT_MS = 30_000
const MAX_SYNC_FALLBACK_SEGMENTS = 2_000
const MAIN_THREAD_DEGRADED_BATCH_SIZE = 500

export const shouldUseMainThreadDegradedEvaluation = ({
  useWorker,
  segmentCount,
  zoneCount,
}: {
  useWorker: boolean
  segmentCount: number
  zoneCount: number
}) => useWorker && zoneCount > 0 && segmentCount > MAX_SYNC_FALLBACK_SEGMENTS

interface UseSegmentEvaluationStateOptions {
  segments: Segment[]
  zones: Zone[]
  datasetHash: string
  nowHHMM: string
  nowHHMMRef: MutableRefObject<string>
  zoneIndex: ZoneIndex | null
  useWorker?: boolean
}

interface UseSegmentEvaluationStateResult {
  workerClientRef: MutableRefObject<EvaluationWorkerClient | null>
  evaluationStatus: SegmentEvaluationStatus
  setEvaluationStatus: Dispatch<SetStateAction<SegmentEvaluationStatus>>
  clipCacheStats: ClipCacheStats | null
  setClipCacheStats: Dispatch<SetStateAction<ClipCacheStats | null>>
  evaluatedSegments: EvaluatedSegment[]
  setEvaluatedSegments: Dispatch<SetStateAction<EvaluatedSegment[]>>
}

export const useSegmentEvaluationState = ({
  segments,
  zones,
  datasetHash,
  nowHHMM,
  nowHHMMRef,
  zoneIndex,
  useWorker = true,
}: UseSegmentEvaluationStateOptions): UseSegmentEvaluationStateResult => {
  const [evaluationStatus, setEvaluationStatus] =
    useState<SegmentEvaluationStatus>('idle')
  const [clipCacheStats, setClipCacheStats] = useState<ClipCacheStats | null>(null)
  const [evaluatedSegments, setEvaluatedSegments] = useState<EvaluatedSegment[]>([])
  const workerClientRef = useRef<EvaluationWorkerClient | null>(null)
  const useMainThreadDegradedEvaluation = shouldUseMainThreadDegradedEvaluation({
    useWorker,
    segmentCount: segments.length,
    zoneCount: zones.length,
  })

  useEffect(() => {
    if (!useMainThreadDegradedEvaluation || segments.length === 0) {
      return
    }

    workerClientRef.current?.terminate()
    workerClientRef.current = null

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const nextSegments: EvaluatedSegment[] = []
    let index = 0
    const evaluator = import('../domain/rules/evaluateSegment')

    queueMicrotask(() => {
      setEvaluationStatus('working')
      setClipCacheStats(null)
    })

    const evaluateBatch = () => {
      if (cancelled) {
        return
      }

      const end = Math.min(
        index + MAIN_THREAD_DEGRADED_BATCH_SIZE,
        segments.length,
      )
      void evaluator
        .then(({ evaluateSegment }) => {
          if (cancelled) {
            return
          }
          for (; index < end; index += 1) {
            nextSegments.push(evaluateSegment(segments[index], nowHHMM))
          }

          if (index < segments.length) {
            timer = setTimeout(evaluateBatch, 0)
            return
          }

          queueMicrotask(() => {
            if (cancelled) {
              return
            }
            setEvaluatedSegments(nextSegments)
            setEvaluationStatus('degraded')
          })
        })
        .catch(() => {
          if (!cancelled) {
            setEvaluationStatus('error')
          }
        })
    }

    timer = setTimeout(evaluateBatch, 0)

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [nowHHMM, segments, useMainThreadDegradedEvaluation])

  useEffect(() => {
    if (
      !useWorker ||
      useMainThreadDegradedEvaluation ||
      segments.length === 0
    ) {
      return
    }

    if (!workerClientRef.current) {
      const worker = new Worker(new URL('../workers/geoWorker.ts', import.meta.url), {
        type: 'module',
      })
      const client = new EvaluationWorkerClient(worker, {
        onInit: () => {
          setEvaluationStatus('working')
          client.evaluate(nowHHMMRef.current)
        },
        onEvaluated: (payload) => {
          setEvaluatedSegments(payload.segments)
          setClipCacheStats(payload.cacheStats ?? null)
          setEvaluationStatus(payload.degraded ? 'degraded' : 'ready')
        },
        onError: () => {
          setEvaluationStatus('error')
        },
      })
      workerClientRef.current = client
    }

    workerClientRef.current.resetRequestId()
    queueMicrotask(() => {
      setEvaluationStatus('working')
    })
    const degradedEvaluationOnly =
      zones.length > 0 && segments.length > MAX_SYNC_FALLBACK_SEGMENTS

    workerClientRef.current.init({
      segments,
      zones: degradedEvaluationOnly ? [] : zones,
      datasetHash,
      zoneParamsVersion: ZONE_PARAMS_VERSION,
      degradedEvaluationOnly,
    })
  }, [
    datasetHash,
    nowHHMMRef,
    segments,
    useMainThreadDegradedEvaluation,
    useWorker,
    zones,
  ])

  useEffect(() => {
    if (!useWorker || useMainThreadDegradedEvaluation) {
      return
    }
    const client = workerClientRef.current
    if (!client || !client.isReady()) {
      return
    }
    queueMicrotask(() => {
      setEvaluationStatus('working')
    })
    client.evaluate(nowHHMM)
  }, [nowHHMM, useMainThreadDegradedEvaluation, useWorker])

  useEffect(() => {
    if (evaluationStatus !== 'working') {
      return
    }

    const timeout = setTimeout(() => {
      setEvaluationStatus((current) =>
        current === 'working' ? 'error' : current,
      )
    }, WORKER_EVALUATION_TIMEOUT_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [evaluationStatus])

  useEffect(() => {
    if (useWorker && evaluationStatus !== 'error') {
      return
    }

    if (!segments.length) {
      queueMicrotask(() => {
        setEvaluatedSegments([])
        setEvaluationStatus('idle')
      })
      return
    }

    if (useWorker && segments.length > MAX_SYNC_FALLBACK_SEGMENTS) {
      queueMicrotask(() => {
        setEvaluatedSegments([])
        setClipCacheStats(null)
      })
      return
    }

    let cancelled = false
    void Promise.all([
      import('../domain/rules/evaluateSegment'),
      import('../domain/geometry/clipCache'),
    ])
      .then(([{ evaluateSegmentWithZones }, { getClipCacheStats }]) => {
        if (cancelled) {
          return
        }
        const fallback = segments.flatMap((segment) =>
          evaluateSegmentWithZones(segment, nowHHMM, zoneIndex),
        )
        queueMicrotask(() => {
          if (cancelled) {
            return
          }
          setEvaluatedSegments(fallback)
          setClipCacheStats(getClipCacheStats())
          setEvaluationStatus('ready')
        })
      })
      .catch(() => {
        if (!cancelled) {
          setEvaluationStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [segments, nowHHMM, zoneIndex, evaluationStatus, useWorker])

  useEffect(() => {
    return () => {
      workerClientRef.current?.terminate()
      workerClientRef.current = null
    }
  }, [])

  return {
    workerClientRef,
    evaluationStatus,
    setEvaluationStatus,
    clipCacheStats,
    setClipCacheStats,
    evaluatedSegments,
    setEvaluatedSegments,
  }
}
