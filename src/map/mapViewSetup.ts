import type { MutableRefObject } from 'react'
import type {
  FeatureCollection,
  Geometry,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson'
import type { Map, MapLayerMouseEvent } from 'maplibre-gl'

interface InitializeMapViewContentOptions {
  coverageBoundaryData: FeatureCollection<Polygon | MultiPolygon> | null
  paidCurbReferenceData: FeatureCollection<Point>
  zonesData: FeatureCollection<Polygon | MultiPolygon>
  intersectionZonesData: FeatureCollection<Polygon | MultiPolygon>
  crosswalkZonesData: FeatureCollection<Polygon | MultiPolygon>
  parkingSpacesData: FeatureCollection<Geometry>
  segmentsData: FeatureCollection<LineString>
  routeData: FeatureCollection<LineString>
  recommendedParkingTargetData: FeatureCollection<Point>
  selectedParkingSpaceData: FeatureCollection<Point>
  userData: FeatureCollection<Point>
  selectedId: string | null
  showZonesRef: MutableRefObject<boolean>
  showIntersectionZonesRef: MutableRefObject<boolean>
  showCrosswalkZonesRef: MutableRefObject<boolean>
  showParkingSpacesRef: MutableRefObject<boolean>
  showInferredCandidatesRef: MutableRefObject<boolean>
  onSelectRef: MutableRefObject<(id: string | null) => void>
  onSelectRecommendedTargetRef: MutableRefObject<
    ((segmentId: string, key: string | null) => void) | undefined
  >
  onSelectParkingSpaceRef: MutableRefObject<((key: string | null) => void) | undefined>
  onPickLocationRef: MutableRefObject<((location: [number, number]) => void) | undefined>
}

const bindPointerCursor = (map: Map, layerId: string) => {
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer'
  })

  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = ''
  })
}

export const initializeMapViewContent = (
  map: Map,
  {
    coverageBoundaryData,
    paidCurbReferenceData,
    zonesData,
    intersectionZonesData,
    crosswalkZonesData,
    parkingSpacesData,
    segmentsData,
    routeData,
    recommendedParkingTargetData,
    selectedParkingSpaceData,
    userData,
    selectedId,
    showZonesRef,
    showIntersectionZonesRef,
    showCrosswalkZonesRef,
    showParkingSpacesRef,
    showInferredCandidatesRef,
    onSelectRef,
    onSelectRecommendedTargetRef,
    onSelectParkingSpaceRef,
    onPickLocationRef,
  }: InitializeMapViewContentOptions,
) => {
  map.addSource('coverage-boundary', {
    type: 'geojson',
    data: coverageBoundaryData ?? {
      type: 'FeatureCollection',
      features: [],
    },
  })

  map.addLayer({
    id: 'coverage-boundary-fill',
    type: 'fill',
    source: 'coverage-boundary',
    paint: {
      'fill-color': [
        'match',
        ['get', 'publishStage'],
        'production',
        '#2aa86b',
        'candidate',
        '#d38a16',
        'source-only',
        '#2385a7',
        '#8f98a8',
      ],
      'fill-opacity': 0.08,
    },
  })

  map.addLayer({
    id: 'coverage-boundary-outline',
    type: 'line',
    source: 'coverage-boundary',
    paint: {
      'line-width': 2.25,
      'line-color': [
        'match',
        ['get', 'publishStage'],
        'production',
        '#54d693',
        'candidate',
        '#f5b52e',
        'source-only',
        '#57c5e8',
        '#b3bccb',
      ],
      'line-opacity': 0.9,
    },
  })

  map.addSource('paid-curb-reference-points', {
    type: 'geojson',
    data: paidCurbReferenceData,
  })

  map.addLayer({
    id: 'paid-curb-reference-points',
    type: 'circle',
    source: 'paid-curb-reference-points',
    paint: {
      'circle-radius': 5.5,
      'circle-color': 'rgba(8, 20, 26, 0.76)',
      'circle-stroke-color': '#57c5e8',
      'circle-stroke-width': 2,
      'circle-opacity': 0.9,
    },
  })

  map.addSource('zones', {
    type: 'geojson',
    data: zonesData,
  })

  map.addLayer({
    id: 'zones-fill',
    type: 'fill',
    source: 'zones',
    layout: {
      visibility: showZonesRef.current ? 'visible' : 'none',
    },
    paint: {
      'fill-color': [
        'match',
        ['get', 'type'],
        'INTERSECTION_BUFFER',
        '#f04d4d',
        'BUS_STOP_BUFFER',
        '#6fb7ff',
        'HYDRANT_BUFFER',
        '#f7d36b',
        '#8f98a8',
      ],
      'fill-opacity': 0.22,
    },
  })

  map.addLayer({
    id: 'zones-outline',
    type: 'line',
    source: 'zones',
    layout: {
      visibility: showZonesRef.current ? 'visible' : 'none',
    },
    paint: {
      'line-width': 1.4,
      'line-color': [
        'match',
        ['get', 'type'],
        'INTERSECTION_BUFFER',
        '#ff8a8a',
        'BUS_STOP_BUFFER',
        '#9fd1ff',
        'HYDRANT_BUFFER',
        '#fbe3a1',
        '#b3bccb',
      ],
      'line-opacity': 0.8,
    },
  })

  map.addSource('intersection-zones', {
    type: 'geojson',
    data: intersectionZonesData,
  })

  map.addLayer({
    id: 'intersection-fill',
    type: 'fill',
    source: 'intersection-zones',
    layout: {
      visibility: showIntersectionZonesRef.current ? 'visible' : 'none',
    },
    paint: {
      'fill-color': '#f04d4d',
      'fill-opacity': 0.28,
    },
  })

  map.addLayer({
    id: 'intersection-outline',
    type: 'line',
    source: 'intersection-zones',
    layout: {
      visibility: showIntersectionZonesRef.current ? 'visible' : 'none',
    },
    paint: {
      'line-width': 1.6,
      'line-color': '#ff8a8a',
      'line-opacity': 0.9,
    },
  })

  map.addSource('crosswalk-zones', {
    type: 'geojson',
    data: crosswalkZonesData,
  })

  map.addLayer({
    id: 'crosswalk-fill',
    type: 'fill',
    source: 'crosswalk-zones',
    layout: {
      visibility: showCrosswalkZonesRef.current ? 'visible' : 'none',
    },
    paint: {
      'fill-color': '#5fe0c8',
      'fill-opacity': 0.26,
    },
  })

  map.addLayer({
    id: 'crosswalk-outline',
    type: 'line',
    source: 'crosswalk-zones',
    layout: {
      visibility: showCrosswalkZonesRef.current ? 'visible' : 'none',
    },
    paint: {
      'line-width': 1.6,
      'line-color': '#8ff2de',
      'line-opacity': 0.9,
    },
  })

  map.addSource('parking-spaces', {
    type: 'geojson',
    data: parkingSpacesData,
  })

  map.addLayer({
    id: 'parking-spaces-fill',
    type: 'fill',
    source: 'parking-spaces',
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: {
      visibility: showParkingSpacesRef.current ? 'visible' : 'none',
    },
    paint: {
      'fill-color': '#5cb8ff',
      'fill-opacity': 0.18,
    },
  })

  map.addLayer({
    id: 'parking-spaces-line',
    type: 'line',
    source: 'parking-spaces',
    filter: [
      'any',
      ['==', ['geometry-type'], 'LineString'],
      ['==', ['geometry-type'], 'Polygon'],
    ],
    layout: {
      visibility: showParkingSpacesRef.current ? 'visible' : 'none',
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': 2,
      'line-color': '#6fd2ff',
      'line-opacity': 0.92,
    },
  })

  map.addLayer({
    id: 'parking-spaces-point',
    type: 'circle',
    source: 'parking-spaces',
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      visibility: showParkingSpacesRef.current ? 'visible' : 'none',
    },
    paint: {
      'circle-radius': 4,
      'circle-color': '#6fd2ff',
      'circle-stroke-color': '#f0f9ff',
      'circle-stroke-width': 1.4,
      'circle-opacity': 0.92,
    },
  })

  map.addSource('segments', {
    type: 'geojson',
    data: segmentsData,
  })

  map.addLayer({
    id: 'segments-line',
    type: 'line',
    source: 'segments',
    filter: ['!=', ['get', 'sourceType'], 'INFERRED'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': 5,
      'line-color': [
        'match',
        ['get', 'tier'],
        'GREEN',
        '#3bd16f',
        'YELLOW',
        '#f5b52e',
        'RED',
        '#f04d4d',
        '#8f98a8',
      ],
      'line-opacity': 0.9,
    },
  })

  map.addLayer({
    id: 'segments-inferred',
    type: 'line',
    source: 'segments',
    filter: ['==', ['get', 'sourceType'], 'INFERRED'],
    layout: {
      visibility: showInferredCandidatesRef.current ? 'visible' : 'none',
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': 4,
      'line-color': [
        'match',
        ['get', 'tier'],
        'GREEN',
        '#3bd16f',
        'YELLOW',
        '#f5b52e',
        'RED',
        '#f04d4d',
        '#8f98a8',
      ],
      'line-opacity': 0.8,
      'line-dasharray': [1.5, 1.2],
    },
  })

  map.addLayer({
    id: 'segments-recommendation-glow',
    type: 'line',
    source: 'segments',
    filter: ['==', ['get', 'showAddressRecommendation'], true],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'addressRecommendationRank'], 0],
        1,
        13,
        3,
        9,
      ],
      'line-color': '#fff0b3',
      'line-opacity': 0.34,
    },
  })

  map.addLayer({
    id: 'segments-recommendation-line',
    type: 'line',
    source: 'segments',
    filter: ['==', ['get', 'showAddressRecommendation'], true],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'addressRecommendationRank'], 0],
        1,
        7,
        3,
        5,
      ],
      'line-color': '#fff8dc',
      'line-opacity': 0.92,
    },
  })

  map.addSource('selected-route', {
    type: 'geojson',
    data: routeData,
  })

  map.addLayer({
    id: 'selected-route-casing',
    type: 'line',
    source: 'selected-route',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': 10,
      'line-color': 'rgba(11, 15, 22, 0.9)',
      'line-opacity': 0.56,
    },
  })

  map.addLayer({
    id: 'selected-route-walking',
    type: 'line',
    source: 'selected-route',
    filter: ['==', ['get', 'profile'], 'walking'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': 5.5,
      'line-color': '#7ee3ff',
      'line-opacity': 0.95,
      'line-dasharray': [0.8, 1.2],
    },
  })

  map.addLayer({
    id: 'selected-route-driving',
    type: 'line',
    source: 'selected-route',
    filter: ['==', ['get', 'profile'], 'driving'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-width': 5.5,
      'line-color': '#ffd36d',
      'line-opacity': 0.95,
    },
  })

  map.addLayer({
    id: 'segments-highlight',
    type: 'line',
    source: 'segments',
    filter: ['==', ['get', 'id'], selectedId ?? ''],
    paint: {
      'line-width': 9,
      'line-color': '#e6f0ff',
      'line-opacity': 0.9,
    },
  })

  map.addSource('recommended-targets', {
    type: 'geojson',
    data: recommendedParkingTargetData,
  })

  map.addLayer({
    id: 'recommended-targets-circle',
    type: 'circle',
    source: 'recommended-targets',
    paint: {
      'circle-radius': 10,
      'circle-color': 'rgba(17, 21, 29, 0.92)',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffe07a',
      'circle-opacity': 0.96,
    },
  })

  map.addLayer({
    id: 'recommended-targets-label',
    type: 'symbol',
    source: 'recommended-targets',
    layout: {
      'text-field': ['get', 'shortLabel'],
      'text-size': 11,
      'text-font': ['Open Sans Bold'],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffe07a',
      'text-halo-color': 'rgba(11, 15, 22, 0.92)',
      'text-halo-width': 1.3,
    },
  })

  map.addSource('selected-space-options', {
    type: 'geojson',
    data: selectedParkingSpaceData,
  })

  map.addLayer({
    id: 'selected-space-options-circle',
    type: 'circle',
    source: 'selected-space-options',
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['get', 'active'], false],
        11,
        9,
      ],
      'circle-color': [
        'case',
        ['boolean', ['get', 'active'], false],
        '#0d1a28',
        '#152536',
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['get', 'active'], false],
        3,
        2,
      ],
      'circle-stroke-color': [
        'case',
        ['boolean', ['get', 'active'], false],
        '#ffe07a',
        '#7ee3ff',
      ],
      'circle-opacity': 0.95,
    },
  })

  map.addLayer({
    id: 'selected-space-options-label',
    type: 'symbol',
    source: 'selected-space-options',
    layout: {
      'text-field': ['get', 'shortLabel'],
      'text-size': 11,
      'text-font': ['Open Sans Bold'],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': [
        'case',
        ['boolean', ['get', 'active'], false],
        '#ffe07a',
        '#dff2ff',
      ],
      'text-halo-color': 'rgba(11, 15, 22, 0.9)',
      'text-halo-width': 1.2,
    },
  })

  map.addSource('user-location', {
    type: 'geojson',
    data: userData,
  })

  map.addLayer({
    id: 'user-dot',
    type: 'circle',
    source: 'user-location',
    paint: {
      'circle-radius': 6,
      'circle-color': '#6fb7ff',
      'circle-stroke-color': '#0b0f16',
      'circle-stroke-width': 2,
    },
  })

  bindPointerCursor(map, 'segments-line')
  bindPointerCursor(map, 'segments-inferred')
  bindPointerCursor(map, 'recommended-targets-circle')
  bindPointerCursor(map, 'recommended-targets-label')
  bindPointerCursor(map, 'selected-space-options-circle')
  bindPointerCursor(map, 'selected-space-options-label')

  map.on('click', 'segments-line', (event) => {
    const feature = event.features?.[0]
    const id = feature?.properties?.id
    if (id) {
      onSelectRef.current(String(id))
    }
  })

  map.on('click', 'segments-inferred', (event) => {
    const feature = event.features?.[0]
    const id = feature?.properties?.id
    if (id) {
      onSelectRef.current(String(id))
    }
  })

  const handleRecommendedTargetClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const segmentId = feature?.properties?.segmentId
    const targetKey = feature?.properties?.targetKey
    if (segmentId && targetKey) {
      onSelectRecommendedTargetRef.current?.(String(segmentId), String(targetKey))
    }
  }

  map.on('click', 'recommended-targets-circle', handleRecommendedTargetClick)
  map.on('click', 'recommended-targets-label', handleRecommendedTargetClick)

  const handleSelectedSpaceClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    const key = feature?.properties?.key
    if (key) {
      onSelectParkingSpaceRef.current?.(String(key))
    }
  }

  map.on('click', 'selected-space-options-circle', handleSelectedSpaceClick)
  map.on('click', 'selected-space-options-label', handleSelectedSpaceClick)

  map.on('click', (event) => {
    const features = map.queryRenderedFeatures(event.point, {
      layers: [
        'segments-line',
        'segments-inferred',
        'recommended-targets-circle',
        'recommended-targets-label',
        'selected-space-options-circle',
        'selected-space-options-label',
      ],
    })
    if (
      features.some((feature) => {
        const layerId = feature.layer?.id
        return (
          layerId === 'recommended-targets-circle' ||
          layerId === 'recommended-targets-label' ||
          layerId === 'selected-space-options-circle' ||
          layerId === 'selected-space-options-label'
        )
      })
    ) {
      return
    }
    if (features.length === 0) {
      onSelectRef.current(null)
      onPickLocationRef.current?.([event.lngLat.lng, event.lngLat.lat])
    }
  })
}
