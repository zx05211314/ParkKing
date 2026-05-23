import {
  getParkingSpaceLabel,
  getParkingSpaceMetadata,
  type ParkingSpaceMatch,
} from '../data/parkingSpaces'
import {
  estimateWalkDistanceMeters,
  getSegmentArrivalTarget,
} from '../map/navigation'
import type { SegmentParkingSpaceOption } from './segmentSheetTypes'

export interface SegmentLike {
  id: string
  path: [number, number][]
}

export interface RecommendationTargetLike {
  rank: number
  targetKind: 'SEGMENT' | 'PARKING_SPACE'
  targetKey: string | null
  destination: [number, number] | null
  segment: {
    id: string
  }
}

export interface SelectedParkingSpaceMarker {
  key: string
  anchor: [number, number]
  shortLabel: string
  active: boolean
}

export interface RecommendedParkingTargetMarker {
  key: string
  segmentId: string
  targetKey: string
  anchor: [number, number]
  shortLabel: string
  active: boolean
}

export interface BuildSelectedParkingTargetDisplayStateOptions {
  selectedSegment: SegmentLike | null
  selectedParkingSpaceKey: string | null
  selectedParkingSpaceMatches: ParkingSpaceMatch[]
  navigationOrigin: [number, number] | null
  maxSelectedParkingSpaceOptions: number
  addressRecommendationTargets: RecommendationTargetLike[]
  selectedId: string | null
}

export interface SelectedParkingTargetDisplayStateResult {
  selectedParkingSpaceMatch: ParkingSpaceMatch | null
  selectedParkingSpaceOptions: SegmentParkingSpaceOption[]
  selectedParkingSpaceMapMarkers: SelectedParkingSpaceMarker[]
  recommendedParkingTargetMarkers: RecommendedParkingTargetMarker[]
  selectedParkingSpaceTargetMode: 'AUTO' | 'MANUAL'
}

export const getSelectedParkingSpaceKey = (
  selectedSegment: SegmentLike | null,
  selectedParkingSpaceKeyBySegment: Record<string, string>,
) => (selectedSegment ? selectedParkingSpaceKeyBySegment[selectedSegment.id] ?? null : null)

export const getVisibleSelectedParkingSpaceMatches = (
  selectedParkingSpaceMatches: ParkingSpaceMatch[],
  selectedParkingSpaceMatch: ParkingSpaceMatch | null,
  maxSelectedParkingSpaceOptions: number,
) => {
  if (selectedParkingSpaceMatches.length <= maxSelectedParkingSpaceOptions) {
    return selectedParkingSpaceMatches
  }
  if (!selectedParkingSpaceMatch) {
    return selectedParkingSpaceMatches.slice(0, maxSelectedParkingSpaceOptions)
  }

  return [
    selectedParkingSpaceMatch,
    ...selectedParkingSpaceMatches
      .filter((match) => match.key !== selectedParkingSpaceMatch.key)
      .slice(0, maxSelectedParkingSpaceOptions - 1),
  ]
}

export const buildSelectedParkingTargetDisplayState = ({
  selectedSegment,
  selectedParkingSpaceKey,
  selectedParkingSpaceMatches,
  navigationOrigin,
  maxSelectedParkingSpaceOptions,
  addressRecommendationTargets,
  selectedId,
}: BuildSelectedParkingTargetDisplayStateOptions): SelectedParkingTargetDisplayStateResult => {
  const selectedParkingSpaceMatch = selectedParkingSpaceKey
    ? selectedParkingSpaceMatches.find((match) => match.key === selectedParkingSpaceKey) ?? null
    : null
  const visibleSelectedParkingSpaceMatches = getVisibleSelectedParkingSpaceMatches(
    selectedParkingSpaceMatches,
    selectedParkingSpaceMatch,
    maxSelectedParkingSpaceOptions,
  )

  const selectedParkingSpaceOptions: SegmentParkingSpaceOption[] = selectedSegment
    ? visibleSelectedParkingSpaceMatches.map((match) => {
        const arrivalTarget = getSegmentArrivalTarget(
          selectedSegment.path,
          navigationOrigin,
          match.anchor,
        )
        const optionIndex =
          selectedParkingSpaceMatches.findIndex(
            (candidate) => candidate.key === match.key,
          ) + 1

        return {
          key: match.key,
          label: getParkingSpaceLabel(match.properties, `Space ${optionIndex}`),
          description: arrivalTarget?.description ?? 'Marked parking space',
          metadata: getParkingSpaceMetadata(match.properties),
          distanceMeters:
            estimateWalkDistanceMeters(navigationOrigin, match.anchor) ??
            Math.round(match.distanceToReferenceMeters),
          active: selectedParkingSpaceKey === match.key,
        }
      })
    : []

  const activeSelectedParkingSpaceOptionKey =
    selectedParkingSpaceMatch?.key ?? selectedParkingSpaceMatches[0]?.key ?? null

  return {
    selectedParkingSpaceMatch,
    selectedParkingSpaceOptions,
    selectedParkingSpaceMapMarkers: selectedParkingSpaceOptions.flatMap((option) => {
      const match = visibleSelectedParkingSpaceMatches.find(
        (candidate) => candidate.key === option.key,
      )
      if (!match) {
        return []
      }

      return [
        {
          key: option.key,
          anchor: match.anchor,
          shortLabel: option.label.replace('Space ', ''),
          active: option.key === activeSelectedParkingSpaceOptionKey,
        },
      ]
    }),
    recommendedParkingTargetMarkers: addressRecommendationTargets.flatMap(
      (recommendation) => {
        if (
          recommendation.segment.id === selectedId ||
          recommendation.targetKind !== 'PARKING_SPACE' ||
          !recommendation.destination ||
          !recommendation.targetKey
        ) {
          return []
        }

        return [
          {
            key: `recommendation-target:${recommendation.segment.id}:${recommendation.targetKey}`,
            segmentId: recommendation.segment.id,
            targetKey: recommendation.targetKey,
            anchor: recommendation.destination,
            shortLabel: String(recommendation.rank),
            active: false,
          },
        ]
      },
    ),
    selectedParkingSpaceTargetMode:
      selectedParkingSpaceMatch !== null ? 'MANUAL' : 'AUTO',
  }
}
