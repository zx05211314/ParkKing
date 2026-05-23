import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SegmentSheetNavigationSection } from './SegmentSheetNavigationSection'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SegmentSheetNavigationSection contract', () => {
  it('renders marked-space targeting and route summaries when navigation is available', () => {
    const html = renderToStaticMarkup(
      <SegmentSheetNavigationSection
        navigationLinks={{
          walking: 'https://example.com/walk',
          driving: 'https://example.com/drive',
        }}
      navigationSourceLabel="Pinned location: Taipei 101"
        arrivalHint="West end of this curb segment"
        navigationTargetKind="PARKING_SPACE"
        routeProfile="walking"
        routeStatus="ready"
        routeError={null}
        onRouteProfileChange={() => {}}
        parkingSpaceOptions={[
          {
            key: 'space-1',
            label: 'A-17',
            description: 'Marked parking space near the west end of this curb segment',
            metadata: ['Open', 'Paid 20 TWD/hr'],
            distanceMeters: 42,
            active: true,
          },
        ]}
        parkingSpaceOptionCount={3}
        parkingSpaceTargetMode="MANUAL"
        onSelectParkingSpace={() => {}}
        routeEta={{
          walkingDistanceMeters: 420,
          walkingDurationSeconds: 320,
          walkingEstimated: false,
          drivingDistanceMeters: 1100,
          drivingDurationSeconds: 180,
          drivingEstimated: false,
        }}
        walkDistanceMeters={420}
      />,
    )

    expect(html).toContain('Go there')
    expect(html).toContain('Target: Marked space')
    expect(html).toContain('Exact marked spaces')
    expect(html).toContain('A-17')
    expect(html).toContain('Open | Paid 20 TWD/hr')
    expect(html).toContain('Walk ETA')
    expect(html).toContain('Drive ETA')
    expect(html).toContain('Walk there')
    expect(html).toContain('Drive there')
  })

  it('renders deployment routing notes without error styling', () => {
    const html = renderToStaticMarkup(
      <SegmentSheetNavigationSection
        navigationLinks={{
          walking: 'https://example.com/walk',
          driving: 'https://example.com/drive',
        }}
      navigationSourceLabel="Pinned location: Taipei 101"
        arrivalHint="West end of this curb segment"
        navigationTargetKind="SEGMENT"
        routeProfile="walking"
        routeStatus="error"
        routeError="Live map routing is not configured for this deployment. External Walk/Drive links still work."
        onRouteProfileChange={() => {}}
        parkingSpaceOptions={[]}
        parkingSpaceOptionCount={0}
        parkingSpaceTargetMode="AUTO"
        onSelectParkingSpace={() => {}}
        routeEta={null}
        walkDistanceMeters={420}
      />,
    )

    expect(html).toContain(
      'Map route: Live map routing is not configured for this deployment. External Walk/Drive links still work.',
    )
    expect(html).not.toContain('segment-sheet-value status-error')
  })

  it('renders proactive deployment routing notes and disables map-route toggles', () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'parkking.example.com',
        origin: 'https://parkking.example.com',
      },
    })

    const html = renderToStaticMarkup(
      <SegmentSheetNavigationSection
        navigationLinks={{
          walking: 'https://example.com/walk',
          driving: 'https://example.com/drive',
        }}
      navigationSourceLabel="Pinned location: Taipei 101"
        arrivalHint="West end of this curb segment"
        navigationTargetKind="SEGMENT"
        routeProfile="walking"
        routeStatus="idle"
        routeError={null}
        onRouteProfileChange={() => {}}
        parkingSpaceOptions={[]}
        parkingSpaceOptionCount={0}
        parkingSpaceTargetMode="AUTO"
        onSelectParkingSpace={() => {}}
        routeEta={null}
        walkDistanceMeters={420}
      />,
    )

    expect(html).toContain(
      'Map route: Live map routing is not configured for this deployment. External Walk/Drive links still work.',
    )
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Walk<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Drive<\/button>/)
  })
})
