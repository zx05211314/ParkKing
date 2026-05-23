import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RuntimeSettingsPanel } from './RuntimeSettingsPanel'
import type { RuntimeSettingsPanelProps } from './runtimeSettingsPanelTypes'

const baseProps: RuntimeSettingsPanelProps = {
  mode: 'NOW',
  nowHHMM: '12:00',
  onModeChange: () => {},
  useMockLocation: true,
  onUseMockLocationChange: () => {},
  locationLabel: 'Mock location',
  radiusMeters: 450,
  onRadiusChange: () => {},
  riskMode: 'NEUTRAL',
  riskModeLabels: {
    CONSERVATIVE: 'Conservative',
    NEUTRAL: 'Neutral',
    AGGRESSIVE: 'Aggressive',
  },
  onRiskModeChange: () => {},
  showZones: true,
  onShowZonesChange: () => {},
  showIntersectionZones: false,
  onShowIntersectionZonesChange: () => {},
  showCrosswalkZones: true,
  onShowCrosswalkZonesChange: () => {},
  showParkingSpaces: true,
  onShowParkingSpacesChange: () => {},
  parkingSpaceCount: 12,
  actionFilteredMarkedSpaceSegmentCount: 4,
  markedSpacesOnly: false,
  onMarkedSpacesOnlyChange: () => {},
  actionFilter: 'STOP_OK',
  actionFilterHiddenCount: 3,
  onActionFilterChange: () => {},
  hideReportedIllegal: true,
  illegalFeedbackHiddenCount: 2,
  onHideReportedIllegalChange: () => {},
  showInferredCandidates: true,
  onShowInferredCandidatesChange: () => {},
  includeInferred: false,
  onIncludeInferredChange: () => {},
}

describe('RuntimeSettingsPanel contract', () => {
  it('renders the main settings groups', () => {
    const html = renderToStaticMarkup(<RuntimeSettingsPanel {...baseProps} />)

    expect(html).toContain('Time mode')
    expect(html).toContain('Location')
    expect(html).toContain('Risk mode')
    expect(html).toContain('Parking spaces')
    expect(html).toContain('Marked-space filter')
    expect(html).toContain('Local feedback filter')
    expect(html).toContain('Inferred candidates')
  })
})
