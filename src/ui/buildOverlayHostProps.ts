import type { OverlayHostProps } from './appPresentationBuilderTypes'

interface BuildOverlayHostPropsOptions {
  selectedSegment: OverlayHostProps['segmentSheetProps']['segment']
  nowHHMM: OverlayHostProps['segmentSheetProps']['nowHHMM']
  onCloseSelectedSegment: OverlayHostProps['segmentSheetProps']['onClose']
  selectedDistance: OverlayHostProps['segmentSheetProps']['distanceMeters']
  selectedWalkDistance: OverlayHostProps['segmentSheetProps']['walkDistanceMeters']
  selectedRouteEta: OverlayHostProps['segmentSheetProps']['routeEta']
  selectedRankBreakdown: OverlayHostProps['segmentSheetProps']['rankBreakdown']
  riskMode: OverlayHostProps['segmentSheetProps']['riskMode']
  latestReport: OverlayHostProps['segmentSheetProps']['latestReport']
  onSegmentReport: OverlayHostProps['segmentSheetProps']['onReport']
  selectedNavigationLinks: OverlayHostProps['segmentSheetProps']['navigationLinks']
  navigationSourceLabel: OverlayHostProps['segmentSheetProps']['navigationSourceLabel']
  selectedArrivalHint: OverlayHostProps['segmentSheetProps']['arrivalHint']
  selectedArrivalKind: OverlayHostProps['segmentSheetProps']['navigationTargetKind'] | null
  selectedRouteProfile: OverlayHostProps['segmentSheetProps']['routeProfile']
  selectedRouteStatus: OverlayHostProps['segmentSheetProps']['routeStatus']
  selectedRouteError: OverlayHostProps['segmentSheetProps']['routeError']
  onSelectedRouteProfileChange: OverlayHostProps['segmentSheetProps']['onRouteProfileChange']
  selectedParkingSpaceOptions: OverlayHostProps['segmentSheetProps']['parkingSpaceOptions']
  selectedParkingSpaceOptionCount: number
  selectedParkingSpaceTargetMode: OverlayHostProps['segmentSheetProps']['parkingSpaceTargetMode']
  onSelectSelectedParkingSpace: OverlayHostProps['segmentSheetProps']['onSelectParkingSpace']
}

export const buildOverlayHostProps = ({
  selectedSegment,
  nowHHMM,
  onCloseSelectedSegment,
  selectedDistance,
  selectedWalkDistance,
  selectedRouteEta,
  selectedRankBreakdown,
  riskMode,
  latestReport,
  onSegmentReport,
  selectedNavigationLinks,
  navigationSourceLabel,
  selectedArrivalHint,
  selectedArrivalKind,
  selectedRouteProfile,
  selectedRouteStatus,
  selectedRouteError,
  onSelectedRouteProfileChange,
  selectedParkingSpaceOptions,
  selectedParkingSpaceOptionCount,
  selectedParkingSpaceTargetMode,
  onSelectSelectedParkingSpace,
}: BuildOverlayHostPropsOptions): OverlayHostProps => ({
  segmentSheetKey: selectedSegment?.id ?? 'none',
  segmentSheetProps: {
    segment: selectedSegment,
    nowHHMM,
    onClose: onCloseSelectedSegment,
    distanceMeters: selectedDistance,
    walkDistanceMeters: selectedWalkDistance,
    routeEta: selectedRouteEta,
    rankBreakdown: selectedRankBreakdown,
    riskMode,
    latestReport,
    onReport: onSegmentReport,
    navigationLinks: selectedNavigationLinks,
    navigationSourceLabel,
    arrivalHint: selectedArrivalHint,
    navigationTargetKind: selectedArrivalKind ?? undefined,
    routeProfile: selectedRouteProfile,
    routeStatus: selectedRouteStatus,
    routeError: selectedRouteError,
    onRouteProfileChange: onSelectedRouteProfileChange,
    parkingSpaceOptions: selectedParkingSpaceOptions,
    parkingSpaceOptionCount: selectedParkingSpaceOptionCount,
    parkingSpaceTargetMode: selectedParkingSpaceTargetMode,
    onSelectParkingSpace: onSelectSelectedParkingSpace,
  },
})
