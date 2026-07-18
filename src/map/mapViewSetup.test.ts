import type { MutableRefObject } from 'react'
import type { FeatureCollection, Point, Polygon } from 'geojson'
import type { Map } from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { initializeMapViewContent } from './mapViewSetup'

const empty = <T,>(): FeatureCollection<T> => ({
  type: 'FeatureCollection',
  features: [],
})

describe('initializeMapViewContent', () => {
  it('adds paid-curb points as a distinct reference-only circle layer', () => {
    const sources = new Map<string, unknown>()
    const layers: Array<Record<string, unknown>> = []
    const map = {
      addSource: (id: string, source: unknown) => sources.set(id, source),
      addLayer: (layer: Record<string, unknown>) => layers.push(layer),
      on: vi.fn(),
      getCanvas: () => ({ style: { cursor: '' } }),
      queryRenderedFeatures: () => [],
    } as unknown as Map
    const paidCurbReferenceData: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [121.3, 24.99] },
          properties: {
            geometryPrecision: 'REPRESENTATIVE_POINT',
            legalAnswerEligible: false,
          },
        },
      ],
    }
    const booleanRef = (current: boolean): MutableRefObject<boolean> => ({
      current,
    })

    initializeMapViewContent(map, {
      coverageBoundaryData: empty<Polygon>(),
      paidCurbReferenceData,
      zonesData: empty<Polygon>(),
      intersectionZonesData: empty<Polygon>(),
      crosswalkZonesData: empty<Polygon>(),
      parkingSpacesData: empty<Point>(),
      segmentsData: empty(),
      routeData: empty(),
      recommendedParkingTargetData: empty(),
      selectedParkingSpaceData: empty(),
      userData: empty(),
      selectedId: null,
      showZonesRef: booleanRef(false),
      showIntersectionZonesRef: booleanRef(false),
      showCrosswalkZonesRef: booleanRef(false),
      showParkingSpacesRef: booleanRef(false),
      showInferredCandidatesRef: booleanRef(false),
      onSelectRef: { current: vi.fn() },
      onSelectRecommendedTargetRef: { current: undefined },
      onSelectParkingSpaceRef: { current: undefined },
      onPickLocationRef: { current: undefined },
    })

    expect(sources.get('paid-curb-reference-points')).toMatchObject({
      type: 'geojson',
      data: paidCurbReferenceData,
    })
    expect(
      layers.find(({ id }) => id === 'paid-curb-reference-points'),
    ).toMatchObject({
      type: 'circle',
      source: 'paid-curb-reference-points',
      paint: {
        'circle-color': 'rgba(8, 20, 26, 0.76)',
        'circle-stroke-color': '#57c5e8',
      },
    })
  })
})
