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
const MAIN_THREAD_ZONE_AWARE_BATCH_SIZE = 100

export type WorkerEvaluationMode =
  | 'disabled'
  | 'base-only'
  | 'zone-aware'
  | 'chunked-zone-aware'

export const resolveWorkerEvaluationMode = ({
  useWorker,
  segmentCount,
  zoneCount,
}: {
  useWorker: boolean
  segmentCount: number
  zoneCount: number
}): WorkerEvaluationMode => {
  if (!useWorker || segmentCount === 0) {
    return 'disabled'
  }
  if (zoneCount === 0) {
    return 'base-only'
  }
  return segmentCount > MAX_SYNC_FALLBACK_SEGMENTS
    ? 'chunked-zone-aware'
    : 'zone-aware'
}

export const shouldUseWorkerEvaluationTimeout = (
  evaluationStatus: SegmentEvaluationStatus,
  workerEvaluationMode: WorkerEvaluationMode,
) =>
  evaluationStatus === 'working' &&
  (workerEvaluationMode === 'base-only' ||
    workerEvaluationMode === 'zone-aware')

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
  const workerEvaluationMode = resolveWorkerEvaluationMode({
    useWorker,
    segmentCount: segments.length,
    zoneCount: zones.length,
  })

  useEffect(() => {
    if (
      workerEvaluationMode !== 'chunked-zone-aware' ||
      !zoneIndex ||
      segments.length === 0
    ) {
      return
    }

    workerClientRef.current?.terminate()
    workerClientRef.current = null

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const nextSegments: EvaluatedSegment[] = []
    let index = 0
    const evaluator = Promise.all([
      import('../domain/rules/evaluateSegment'),
      import('../domain/geometry/clipCache'),
    ])

    queueMicrotask(() => {
      setEvaluationStatus('working')
      setClipCacheStats(null)
    })

    const evaluateBatch = () => {
      if (cancelled) {
        return
      }

      const end = Math.min(
        index + MAIN_THREAD_ZONE_AWARE_BATCH_SIZE,
        segments.length,
      )
      void evaluator
        .then(([{ evaluateSegmentWithZones }, { getClipCacheStats }]) => {
          if (cancelled) {
            return
          }
          for (; index < end; index += 1) {
            nextSegments.push(
              ...evaluateSegmentWithZones(segments[index], nowHHMM, zoneIndex),
            )
          }

          if (index < segments.length) {
            timer = setTimeout(evaluateBatch, 0)
            return
          }

          setEvaluatedSegments(nextSegments)
          setClipCacheStats(getClipCacheStats())
          setEvaluationStatus('ready')
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
  }, [nowHHMM, segments, workerEvaluationMode, zoneIndex])

  useEffect(() => {
    if (
      workerEvaluationMode === 'disabled' ||
      workerEvaluationMode === 'chunked-zone-aware'
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
    workerClientRef.current.init({
      segments,
      zones: workerEvaluationMode === 'zone-aware' ? zones : [],
      datasetHash,
      zoneParamsVersion: ZONE_PARAMS_VERSION,
      degradedEvaluationOnly: false,
    })
  }, [
    datasetHash,
    nowHHMMRef,
    segments,
    useWorker,
    workerEvaluationMode,
    zones,
  ])

  useEffect(() => {
    if (
      workerEvaluationMode === 'disabled' ||
      workerEvaluationMode === 'chunked-zone-aware'
    ) {
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
  }, [nowHHMM, workerEvaluationMode])

  useEffect(() => {
    if (
      !shouldUseWorkerEvaluationTimeout(
        evaluationStatus,
        workerEvaluationMode,
      )
    ) {
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
  }, [evaluationStatus, workerEvaluationMode])

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
      let cancelled = false
      let timer: ReturnType<typeof setTimeout> | null = null
      const nextSegments: EvaluatedSegment[] = []
      let index = 0
      const evaluator = import('../domain/rules/evaluateSegment')

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
            setEvaluatedSegments(nextSegments)
            setClipCacheStats(null)
            setEvaluationStatus('degraded')
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
