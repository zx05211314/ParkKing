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
    const layerClickHandlers = new Map<string, (event: unknown) => void>()
    let mapClickHandler: ((event: unknown) => void) | null = null
    let renderedFeatures: Array<{ layer?: { id?: string } }> = []
    const onSelectPaidCurbReference = vi.fn()
    const onPickLocation = vi.fn()
    const map = {
      addSource: (id: string, source: unknown) => sources.set(id, source),
      addLayer: (layer: Record<string, unknown>) => layers.push(layer),
      on: vi.fn(
        (
          eventName: string,
          layerOrHandler: string | ((event: unknown) => void),
          handler?: (event: unknown) => void,
        ) => {
          if (eventName !== 'click') {
            return
          }
          if (typeof layerOrHandler === 'string' && handler) {
            layerClickHandlers.set(layerOrHandler, handler)
          } else if (typeof layerOrHandler === 'function') {
            mapClickHandler = layerOrHandler
          }
        },
      ),
      getCanvas: () => ({ style: { cursor: '' } }),
      queryRenderedFeatures: () => renderedFeatures,
    } as unknown as Map
    const paidCurbFeature = {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [121.3, 24.99],
      },
      properties: {
        evidenceKind: 'PAID_CURB_SEGMENT',
        parkingSegmentId: '169',
        districtId: 'taoyuan-district',
        description: 'Road A',
        fareDescription: '20 per hour',
        hasChargingPoint: false,
        geometryPrecision: 'REPRESENTATIVE_POINT',
        legalAnswerEligible: false,
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
      },
    }
    const paidCurbReferenceData: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [paidCurbFeature],
    }
    const booleanRef = (current: boolean): MutableRefObject<boolean> => ({
      current,
    })

    initializeMapViewContent(map, {
      coverageBoundaryData: empty<Polygon>(),
      paidCurbReferenceData,
      selectedPaidCurbReferenceId: null,
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
      onSelectPaidCurbReferenceRef: {
        current: onSelectPaidCurbReference,
      },
      onPickLocationRef: { current: onPickLocation },
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
    expect(
      layers.find(({ id }) => id === 'paid-curb-reference-selected'),
    ).toMatchObject({
      type: 'circle',
      source: 'paid-curb-reference-points',
      filter: ['==', ['get', 'parkingSegmentId'], ''],
      paint: {
        'circle-stroke-color': '#ffe07a',
      },
    })

    layerClickHandlers.get('paid-curb-reference-points')?.({
      features: [paidCurbFeature],
    })
    expect(onSelectPaidCurbReference).toHaveBeenCalledWith({
      parkingSegmentId: '169',
      districtId: 'taoyuan-district',
      description: 'Road A',
      fareDescription: '20 per hour',
      hasChargingPoint: false,
      coordinates: [121.3, 24.99],
    })

    renderedFeatures = [
      {
        layer: {
          id: 'paid-curb-reference-points',
        },
      },
    ]
    mapClickHandler?.({
      point: { x: 10, y: 10 },
      lngLat: { lng: 121.3, lat: 24.99 },
    })
    expect(onPickLocation).not.toHaveBeenCalled()
  })
})
