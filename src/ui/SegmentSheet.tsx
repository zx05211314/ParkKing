import { SegmentSheetFeedbackSection } from './SegmentSheetFeedbackSection'
import { SegmentSheetNavigationSection } from './SegmentSheetNavigationSection'
import { SegmentSheetOverrideSection } from './SegmentSheetOverrideSection'
import { SegmentSheetSummarySection } from './SegmentSheetSummarySection'
import { SegmentSheetTimeWindowsSection } from './SegmentSheetTimeWindowsSection'
import type {
  SegmentParkingSpaceOption,
  SegmentRouteEta,
  SegmentSheetProps,
} from './segmentSheetTypes'

export const SegmentSheet = ({
  segment,
  nowHHMM,
  onClose,
  distanceMeters,
  walkDistanceMeters,
  routeEta,
  rankBreakdown,
  riskMode,
  latestReport,
  onReport,
  navigationLinks,
  navigationSourceLabel,
  arrivalHint = null,
  navigationTargetKind = 'SEGMENT',
  routeProfile = 'walking',
  routeStatus = 'idle',
  routeError = null,
  onRouteProfileChange,
  parkingSpaceOptions = [],
  parkingSpaceOptionCount = 0,
  parkingSpaceTargetMode = 'AUTO',
  onSelectParkingSpace,
}: SegmentSheetProps) => {
  return (
    <div className={segment ? 'segment-sheet open' : 'segment-sheet'}>
      <div className="segment-sheet-header">
        <div>
          <div className="segment-sheet-title">
            {segment ? segment.name : 'No segment selected'}
          </div>
          <div className="segment-sheet-subtitle">Time context: {nowHHMM}</div>
        </div>
        {segment ? (
          <button type="button" className="sheet-close" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      {segment ? (
        <div className="segment-sheet-content">
          <SegmentSheetSummarySection
            segment={segment}
            rankBreakdown={rankBreakdown}
            riskMode={riskMode}
            distanceMeters={distanceMeters}
          />
          <SegmentSheetNavigationSection
            navigationLinks={navigationLinks}
            navigationSourceLabel={navigationSourceLabel}
            arrivalHint={arrivalHint}
            navigationTargetKind={navigationTargetKind}
            routeProfile={routeProfile}
            routeStatus={routeStatus}
            routeError={routeError}
            onRouteProfileChange={onRouteProfileChange}
            parkingSpaceOptions={parkingSpaceOptions}
            parkingSpaceOptionCount={parkingSpaceOptionCount}
            parkingSpaceTargetMode={parkingSpaceTargetMode}
            onSelectParkingSpace={onSelectParkingSpace}
            routeEta={routeEta}
            walkDistanceMeters={walkDistanceMeters}
          />

          {segment.riskTags && segment.riskTags.length > 0 ? (
            <div className="segment-sheet-section">
              <div className="segment-sheet-label">Risk tags</div>
              <ul>
                {segment.riskTags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <SegmentSheetOverrideSection signOverride={segment.signOverride} />
          <SegmentSheetFeedbackSection
            segment={segment}
            latestReport={latestReport}
            onReport={onReport}
          />
          <SegmentSheetTimeWindowsSection
            title="Time windows"
            windows={segment.timeWindows}
          />
        </div>
      ) : (
        <div className="segment-sheet-empty">
          Tap a curb segment to see its rules and confidence.
        </div>
      )}
    </div>
  )
}

export type { SegmentParkingSpaceOption, SegmentRouteEta, SegmentSheetProps }
