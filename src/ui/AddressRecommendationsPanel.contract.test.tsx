import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AddressRecommendationsPanel } from './AddressRecommendationsPanel'
import type { SegmentReport } from '../feedback/reports'
import type { AddressRecommendationsPanelProps } from './addressRecommendationsPanelTypes'

afterEach(() => {
  vi.unstubAllGlobals()
})

const bestReport: SegmentReport = {
  schemaVersion: 1,
  districtId: 'xinyi',
  segmentId: 'best-segment',
  status: 'LEGAL',
  note: 'Night access looks good',
  createdAt: '2026-03-18T09:00:00.000Z',
}

const alternativeReport: SegmentReport = {
  schemaVersion: 1,
  districtId: 'xinyi',
  segmentId: 'alt-segment',
  status: 'UNCLEAR',
  createdAt: '2026-03-18T09:10:00.000Z',
}

const baseProps: AddressRecommendationsPanelProps = {
  hasPinnedAddress: true,
  recommendationRankMode: 'WALK',
  recommendationRankModeLabels: {
    WALK: 'Walk',
    DRIVE: 'Drive',
    DISTANCE: 'Distance',
  },
  addressRecommendationRankingLabel:
    'Ranked by walk ETA to exact targets, then marked spaces',
  addressRecommendationFeedbackLabel:
    'Local feedback is adjusting 2 nearby options.',
  parkingAnswerServiceStatus: 'ready',
  parkingAnswerServiceError: null,
  parkingCoverageNotice: null,
  parkingAnswer: {
    kind: 'PARK',
    label: 'Parking is allowed at the nearest mapped curb for this time.',
    scope: 'NEAREST_MAPPED_CURB',
    location: [121.564, 25.032],
    searchRadiusMeters: 60,
    includeInferred: false,
    primary: {
      id: 'best-segment',
      name: 'Civic West',
      tier: 'GREEN',
      allowedNow: 'PARK',
      curbMarking: 'YELLOW',
      confidence: 'HIGH',
      path: [
        [121.564, 25.032],
        [121.565, 25.033],
      ],
      reasonCodes: ['PARKING_SPACE_EVIDENCE'],
      reasons: ['official marked parking spaces mapped along this curb'],
      timeWindows: [],
      coverageConfidence: 'HIGH',
      overrideConfidence: 'HIGH',
      finalConfidence: 'HIGH',
      sourceReliability: 'HIGH',
      dataFreshnessDays: 3,
      distanceMeters: 0,
      rankScore: 7,
      parkingSpaceCount: 6,
    },
    alternatives: [],
    evidence: {
      kind: 'MARKED_SPACE',
      label: '6 mapped official marked parking spaces near this curb.',
      parkingSpaceCount: 6,
      caveats: [],
    },
    caveats: [],
  },
  parkingAnswerReport: bestReport,
  nearbySnapshot: {
    total: 5,
    parkCount: 3,
    stopCount: 1,
    noStopCount: 1,
    markedSpaceCount: 4,
    etaReadyCount: 2,
  },
  bestAddressRecommendation: {
    id: 'best-segment',
    name: 'Civic West',
    tier: 'GREEN',
    allowedNow: 'PARK',
    sourceType: 'CURB',
    distanceMeters: 120,
    parkingSpaceCount: 6,
    reasonCodes: ['PARKING_SPACE_EVIDENCE'],
  },
  bestAddressRecommendationTarget: {
    rank: 1,
    segment: {
      id: 'best-segment',
      name: 'Civic West',
      tier: 'GREEN',
      allowedNow: 'PARK',
      sourceType: 'CURB',
      distanceMeters: 120,
      parkingSpaceCount: 6,
      reasonCodes: ['PARKING_SPACE_EVIDENCE'],
    },
    targetKey: 'space:12',
    targetKind: 'PARKING_SPACE',
    targetLabel: 'Space 12',
    targetMetadata: ['Covered', 'Metered'],
    destination: [121.565, 25.033],
    description: 'Closest marked space on the west side',
  },
  bestAddressRecommendationReason: 'Fastest legal walk target',
  bestAddressRecommendationFeedback:
    'Locally verified legal | Mar 18 | Night access looks good',
  bestAddressRecommendationReport: bestReport,
  bestAddressRecommendationArrivalHint: 'Arrive near the west end',
  bestAddressRecommendationArrivalKind: 'PARKING_SPACE',
  bestAddressRecommendationWalkDistance: 160,
  bestAddressRecommendationNavigationLinks: {
    walking: 'https://example.test/walk',
    driving: 'https://example.test/drive',
  },
  bestAddressRecommendationRouteEta: {
    walkingDistanceMeters: 180,
    walkingDurationSeconds: 240,
    walkingEstimated: false,
    drivingDistanceMeters: 420,
    drivingDurationSeconds: 120,
    drivingEstimated: true,
  },
  alternativeAddressRecommendations: [
    {
      rank: 2,
      segment: {
        id: 'alt-segment',
        name: 'Civic East',
        tier: 'YELLOW',
        allowedNow: 'TEMP_STOP',
        distanceMeters: 220,
        parkingSpaceCount: 2,
      },
      targetKey: 'segment',
      targetKind: 'SEGMENT',
      targetLabel: 'East curb',
      targetMetadata: ['Short stay'],
      destination: [121.566, 25.034],
      description: 'Fallback curb target',
    },
  ],
  addressRecommendationEmptyMessage: 'No pinned-location candidates.',
  routeEtaStatus: 'loading',
  routeEtaError: 'Using cached route fallback.',
  routeEtaBySegmentId: {
    'best-segment': {
      walkingDistanceMeters: 180,
      walkingDurationSeconds: 240,
      walkingEstimated: false,
      drivingDistanceMeters: 420,
      drivingDurationSeconds: 120,
      drivingEstimated: true,
    },
    'alt-segment': {
      walkingDistanceMeters: 260,
      walkingDurationSeconds: 300,
      walkingEstimated: true,
      drivingDistanceMeters: null,
      drivingDurationSeconds: null,
      drivingEstimated: false,
    },
  },
  reportsBySegment: {
    'best-segment': bestReport,
    'alt-segment': alternativeReport,
  },
  navigationOrigin: [121.564, 25.032],
  searchLocation: [121.564, 25.032],
  selectedId: 'alt-segment',
  bestRecommendationIndex: 3,
  alternativeRecommendationOffset: 10,
  registerSearchActionRef: () => {},
  formatDistanceMeters: (value) => `${value ?? 0} m`,
  formatParkingSpaceCount: (value) =>
    typeof value === 'number' && value > 0 ? `${value} spaces` : null,
  formatWalkDistanceMeters: (value) => `Walk ${value ?? 0} m`,
  formatRouteDistanceMeters: (value) => `${value ?? 0} m route`,
  formatEtaDuration: (value) =>
    value === null || value === undefined ? null : `${value} sec`,
  formatRecommendationLabel: (rank) => `#${rank}`,
  onSearchActionKeyDown: () => {},
  onRecommendationRankModeChange: () => {},
  onParkingAnswerReport: () => {},
  onSelectAddressRecommendation: () => {},
  onSaveBestRecommendationPlan: () => {},
  onNavigateToRecommendation: () => {},
}

describe('AddressRecommendationsPanel contract', () => {
  it('renders ranking controls, snapshot, best target, and alternatives', () => {
    const html = renderToStaticMarkup(<AddressRecommendationsPanel {...baseProps} />)

    expect(html).toContain('Top nearby parking')
    expect(html).toContain('Pinned location answer')
    expect(html).toContain('Park allowed at nearest mapped curb')
    expect(html).toContain(
      'Decision: Use this curb only if posted signs still match the mapped rule.',
    )
    expect(html).toContain('Trust')
    expect(html).toContain('High trust')
    expect(html).toContain('Next step')
    expect(html).toContain('Likely parkable if the current curb signs still match.')
    expect(html).toContain('HIGH confidence')
    expect(html).toContain('Nearest curb: 0 m')
    expect(html).toContain('Search radius: 60 m')
    expect(html).toContain('Evidence type: Mapped marked spaces')
    expect(html).toContain(
      'Evidence strength: 6 mapped official marked parking spaces near this curb.',
    )
    expect(html).toContain('Field checks before relying on this:')
    expect(html).toContain(
      'Confirm the posted curb signs still allow parking at this time.',
    )
    expect(html).toContain(
      'Confirm the marked space still exists and is not blocked by temporary signs.',
    )
    expect(html).toContain('Correct this pinned answer')
    expect(html).toContain('Locally verified legal')
    expect(html).toContain('Latest pinned report:')
    expect(html).toContain('Night access looks good')
    expect(html).toContain('Optional evidence note for this pinned curb')
    expect(html).toContain('Alternatives checked: 0')
    expect(html).toContain('Inferred candidates excluded')
    expect(html).toContain('Evidence: 6 mapped official marked parking spaces near this curb.')
    expect(html).toContain('Rank by')
    expect(html).toContain('Loading live walk ETA.')
    expect(html).toContain('ETA note: Using cached route fallback.')
    expect(html).toContain('Local feedback is adjusting 2 nearby options.')
    expect(html).toContain('Park ok')
    expect(html).toContain('Best exact target')
    expect(html).toContain('Civic West')
    expect(html).toContain('Space-backed')
    expect(html).toContain('Arrival: Arrive near the west end')
    expect(html).toContain('Exact target: Space 12')
    expect(html).toContain('Target type: Marked space')
    expect(html).toContain('Save target')
    expect(html).toContain('Walk there')
    expect(html).toContain('Drive there')
    expect(html).toContain('Other nearby options')
    expect(html).toContain('Civic East')
    expect(html).toContain('Fallback curb target')
    expect(html).toContain('Open')
  })

  it('renders the empty recommendation message when no ranked target is available', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        bestAddressRecommendation={null}
        bestAddressRecommendationTarget={null}
      />,
    )

    expect(html).toContain('Pinned location answer')
    expect(html).toContain(
      'Exact curb answer is shown above. Route-ranked parking targets are unavailable with the current filters or route data.',
    )
    expect(html).not.toContain('No pinned-location candidates.')
  })

  it('keeps the raw empty message when no exact curb answer exists', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingAnswer={{
          ...baseProps.parkingAnswer!,
          kind: 'NO_DATA',
          primary: null,
          evidence: {
            kind: 'NO_DATA',
            label: 'No mapped curb or parking-space evidence matched this pinned point.',
            parkingSpaceCount: 0,
            caveats: [],
          },
          caveats: [],
        }}
        bestAddressRecommendation={null}
        bestAddressRecommendationTarget={null}
      />,
    )

    expect(html).toContain('No mapped curb answer')
    expect(html).toContain('No answer')
    expect(html).toContain(
      'Move the pin or use a nearby ranked target before deciding.',
    )
    expect(html).toContain('No pinned-location candidates.')
  })

  it('renders all pinned answer caveats', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingAnswer={{
          ...baseProps.parkingAnswer!,
          caveats: [
            'Source curb data may be stale.',
            'This answer has low confidence.',
          ],
        }}
      />,
    )

    expect(html).toContain(
      'Caveats: Source curb data may be stale.; This answer has low confidence.',
    )
  })

  it('surfaces degraded service readiness while showing fallback answers', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingAnswerServiceStatus="degraded"
        parkingAnswerServiceError="Parking answer API readiness is degraded. xinyi: missing sign_overrides.geojson."
      />,
    )

    expect(html).toContain('Park allowed at nearest mapped curb')
    expect(html).toContain(
      'Service: Parking answer API readiness is degraded. xinyi: missing sign_overrides.geojson.',
    )
  })

  it('surfaces service errors even when no fallback answer is available', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingAnswer={null}
        parkingAnswerServiceStatus="error"
        parkingAnswerServiceError="Parking answer request failed with 500."
      />,
    )

    expect(html).toContain('Exact answer unavailable')
    expect(html).toContain('Service: Parking answer request failed with 500.')
  })

  it('blocks cross-district answers and recommendations outside active coverage', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingCoverageNotice="This location is outside the active Xinyi dataset. ParkKing did not calculate a parking legality answer here."
      />,
    )

    expect(html).toContain('Outside active coverage')
    expect(html).toContain('NOT EVALUATED')
    expect(html).toContain(
      'No parking recommendation was calculated from another district',
    )
    expect(html).toContain('Parking recommendations are hidden')
    expect(html).not.toContain('Park allowed at nearest mapped curb')
  })

  it('shows non-spatial Taoyuan source text without restoring recommendations', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingCoverageNotice="This location is in Taoyuan source-only coverage. No parking legality answer was calculated."
        parkingCoverageReferenceAddressLabel="桃園市桃園區縣府路1號"
        parkingCoverageReferenceState={{
          status: 'ready',
          sourceUrl: '/data/reference/taoyuan-paid-curb.json',
          error: null,
          district: {
            districtId: 'taoyuan-district',
            districtName: 'Taoyuan',
            boundaryFeatureId: '68000010',
            recordCount: 1,
            records: [
              {
                parkingSegmentId: '169',
                description: '縣府路園區',
                fareDescription: '20元/30分鐘',
                hasChargingPoint: false,
                sourceTownName: '桃園區',
              },
            ],
          },
        }}
      />,
    )

    expect(html).toContain('Official paid-curb source text')
    expect(html).toContain('縣府路園區')
    expect(html).toContain('not spatial matches')
    expect(html).toContain('Parking recommendations are hidden')
    expect(html).not.toContain('Park allowed at nearest mapped curb')
  })

  it('renders a direct no-stop decision for blocked pinned curbs', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingAnswer={{
          ...baseProps.parkingAnswer!,
          kind: 'NO_STOP',
          primary: {
            ...baseProps.parkingAnswer!.primary!,
            allowedNow: 'NO_STOP',
            parkingSpaceCount: 0,
            distanceMeters: 18,
          },
          evidence: {
            kind: 'CURB_RULE',
            label:
              'Curb rule answer; no official marked-space evidence is mapped on this curb.',
            parkingSpaceCount: 0,
            caveats: [
              'No official marked parking-space evidence is mapped on the selected curb.',
            ],
          },
          caveats: [
            'No official marked parking-space evidence is mapped on the selected curb.',
          ],
        }}
      />,
    )

    expect(html).toContain('Do not stop or park here')
    expect(html).toContain('Blocked')
    expect(html).toContain('Decision: Avoid stopping or parking at this pinned curb.')
    expect(html).toContain('Do not stop or park at this pinned curb.')
    expect(html).toContain('Nearest curb: 18 m')
    expect(html).toContain('Evidence type: Mapped curb rule')
    expect(html).toContain(
      'Choose another curb; this pinned point is mapped as no-stop or no-parking.',
    )
  })

  it('renders an explicit no-data decision when no curb answer exists', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        parkingAnswer={{
          ...baseProps.parkingAnswer!,
          kind: 'NO_DATA',
          primary: null,
          evidence: {
            kind: 'NO_DATA',
            label: 'No mapped curb or parking-space evidence matched this pinned point.',
            parkingSpaceCount: 0,
            caveats: [],
          },
          caveats: [],
        }}
      />,
    )

    expect(html).toContain('No mapped curb answer')
    expect(html).toContain('No answer')
    expect(html).toContain(
      'Decision: Pick a nearby curb segment or widen the search radius.',
    )
    expect(html).toContain(
      'Do not infer legality from an empty map result.',
    )
    expect(html).toContain('Nearest curb: No curb within 60 m')
    expect(html).toContain('Evidence type: No mapped evidence')
  })

  it('renders deployment routing notes without error styling', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        routeEtaStatus="error"
        routeEtaError="Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available."
      />,
    )

    expect(html).toContain('ETA note: Live ETA routing is not configured for this deployment.')
    expect(html).not.toContain('control-meta status-error')
  })

  it('renders proactive deployment routing notes before live ETA requests fail', () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'parkking.example.com',
        origin: 'https://parkking.example.com',
      },
    })

    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        routeEtaStatus="idle"
        routeEtaError={null}
      />,
    )

    expect(html).toContain('ETA note: Live ETA routing is not configured for this deployment.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Walk<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Drive<\/button>/)
  })

  it('falls back to parking-space evidence copy when the best-reason string is missing', () => {
    const html = renderToStaticMarkup(
      <AddressRecommendationsPanel
        {...baseProps}
        bestAddressRecommendationReason={null}
        bestAddressRecommendation={{
          ...baseProps.bestAddressRecommendation!,
          dataFreshnessDays: 900,
        }}
      />,
    )

    expect(html).toContain(
      'Why: High-confidence parking backed by mapped official marked spaces despite an old curb-paint timestamp',
    )
  })
})
