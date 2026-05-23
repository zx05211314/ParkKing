import type { SegmentSheetProps } from './segmentSheetTypes'

export type SegmentSheetNavigationSectionProps = Pick<
  SegmentSheetProps,
  | 'navigationLinks'
  | 'navigationSourceLabel'
  | 'arrivalHint'
  | 'navigationTargetKind'
  | 'routeProfile'
  | 'routeStatus'
  | 'routeError'
  | 'onRouteProfileChange'
  | 'parkingSpaceOptions'
  | 'parkingSpaceOptionCount'
  | 'parkingSpaceTargetMode'
  | 'onSelectParkingSpace'
  | 'routeEta'
  | 'walkDistanceMeters'
>
