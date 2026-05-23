import { useMemo } from 'react'
import { getRankBreakdown, type RankBreakdown, type RiskMode } from '../domain/ranking/rank'
import { distanceMeters, getPathMidpoint } from '../map/geo'
import {
  normalizeReportSegmentId,
  type SegmentReport,
} from '../feedback/reports'
import type { EvaluatedSegment } from './types'

interface SelectedSegmentLike extends EvaluatedSegment {
  distanceMeters?: number
}

interface UseSelectedSegmentDetailStateOptions {
  selectedSegment: SelectedSegmentLike | null
  reportsBySegment: Record<string, SegmentReport>
  activeDistanceLocation: [number, number] | null
  riskMode: RiskMode
}

interface UseSelectedSegmentDetailStateResult {
  latestReport: SegmentReport | null
  selectedDistance: number | null
  selectedRankBreakdown: RankBreakdown | null
}

export const useSelectedSegmentDetailState = ({
  selectedSegment,
  reportsBySegment,
  activeDistanceLocation,
  riskMode,
}: UseSelectedSegmentDetailStateOptions): UseSelectedSegmentDetailStateResult => {
  const latestReport = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    return reportsBySegment[normalizeReportSegmentId(selectedSegment.id)] ?? null
  }, [reportsBySegment, selectedSegment])

  const selectedDistance = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    if (selectedSegment.distanceMeters !== undefined) {
      return selectedSegment.distanceMeters
    }
    if (!activeDistanceLocation) {
      return null
    }
    return distanceMeters(activeDistanceLocation, getPathMidpoint(selectedSegment.path))
  }, [selectedSegment, activeDistanceLocation])

  const selectedRankBreakdown = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    return getRankBreakdown(selectedSegment, selectedDistance ?? undefined, riskMode)
  }, [riskMode, selectedDistance, selectedSegment])

  return {
    latestReport,
    selectedDistance,
    selectedRankBreakdown,
  }
}
