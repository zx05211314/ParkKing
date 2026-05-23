import { useEffect, useState } from 'react'
import type { ParkingAnswer } from '../domain/answers/parkingAnswer'
import type { RiskMode } from '../domain/ranking/policy'
import type { ZoneIndex } from '../domain/zones/zoneIndex'
import type { Segment } from './types'

interface UseClientParkingAnswerStateOptions {
  segments: Segment[]
  searchLocation: [number, number] | null
  nowHHMM: string
  zoneIndex: ZoneIndex | null
  includeInferred: boolean
  riskMode: RiskMode
  reviewedSignOverridesCount: number | null
  appliedSignOverridesCount: number | null
}

export const useClientParkingAnswerState = ({
  segments,
  searchLocation,
  nowHHMM,
  zoneIndex,
  includeInferred,
  riskMode,
  reviewedSignOverridesCount,
  appliedSignOverridesCount,
}: UseClientParkingAnswerStateOptions) => {
  const [answer, setAnswer] = useState<ParkingAnswer | null>(null)

  useEffect(() => {
    if (!searchLocation) {
      setAnswer(null)
      return
    }

    let cancelled = false
    setAnswer(null)
    void import('../domain/answers/parkingAnswer')
      .then(({ buildParkingAnswerFromSegments }) => {
        if (cancelled) {
          return
        }
        setAnswer(
          buildParkingAnswerFromSegments(segments, searchLocation, {
            nowHHMM,
            zoneIndex,
            includeInferred,
            riskMode,
            reviewedSignOverridesCount,
            appliedSignOverridesCount,
          }),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setAnswer(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    appliedSignOverridesCount,
    includeInferred,
    nowHHMM,
    reviewedSignOverridesCount,
    riskMode,
    searchLocation,
    segments,
    zoneIndex,
  ])

  return answer
}
