import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { Map, GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type {
  FeatureCollection,
  Geometry,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson'
import type { EvaluatedSegment } from '../ui/types'
import type { Zone } from '../domain/zones/zoneTypes'
import type { PinnedCoverageBoundary } from '../data/coverageDisplay'
import { expandBounds, type MapBounds } from './bounds'
import type { RouteProfile } from './routing'
import { createBasemapStyle } from './style'
import { initializeMapViewContent } from './mapViewSetup'
import { shouldApplyDatasetMapFocus } from './mapFocusPriority'

interface SelectedParkingSpaceMarker {
  key: string
  anchor: [number, number]
  shortLabel: string
  active: boolean
}

interface RecommendedParkingTargetMarker {
  key: string
  segmentId: string
  targetKey: string
  anchor: [number, number]
  shortLabel: string
  active: boolean
}

const EMPTY_COVERAGE_BOUNDARY_DATA: FeatureCollection<Polygon | MultiPolygon> = {
  type: 'FeatureCollection',
  features: [],
}

export interface MapViewProps {
  center: [number, number]
  districtBounds?: MapBounds | null
  districtBoundsKey?: string | null
  segments: EvaluatedSegment[]
  zones: Zone[]
  intersectionZones: Zone[]
  showZones: boolean
  showIntersectionZones: boolean
  crosswalkZones: Zone[]
  showCrosswalkZones: boolean
  parkingSpaces: FeatureCollection<Geometry>
  showParkingSpaces: boolean
  showInferredCandidates: boolean
  selectedId: string | null
  focusBounds?: MapBounds | null
  focusBoundsKey?: string | null
  focusCenter?: [number, number] | null
  focusCenterKey?: string | null
  recommendedSegmentIds?: string[]
  searchLocation?: [number, number] | null
  searchLocationLabel?: string | null
  coverageBoundary?: PinnedCoverageBoundary | null
  arrivalLocation?: [number, number] | null
  arrivalLocationKind?: 'SEGMENT' | 'PARKING_SPACE' | null
  arrivalLocationLabel?: string | null
  recommendedParkingTargetMarkers?: RecommendedParkingTargetMarker[]
  selectedParkingSpaceMarkers?: SelectedParkingSpaceMarker[]
  routeProfile?: RouteProfile
  routeGeometry?: [number, number][] | null
  userLocation: [number, number] | null
  onSelect: (id: string | null) => void
  onSelectRecommendedTarget?: (segmentId: string, key: string | null) => void
  onSelectParkingSpace?: (key: string | null) => void
  onPickLocation?: (location: [number, number]) => void
}

const buildFeatureCollection = (
  segments: EvaluatedSegment[],
  recommendedRanks: Record<string, number>,
  showInferredCandidates: boolean,
): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: segments.map((segment) => ({
    properties: (() => {
      const sourceType = segment.sourceType ?? 'CURB'
      const recommendationRank = recommendedRanks[segment.id] ?? 0

      return {
        id: segment.id,
        tier: segment.tier,
        allowedNow: segment.allowedNow,
        name: segment.name,
        curbMarking: segment.curbMarking,
        sourceType,
        addressRecommendationRank: recommendationRank,
        showAddressRecommendation:
          recommendationRank > 0 &&
          (sourceType !== 'INFERRED' || showInferredCandidates),
      }
    })(),
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: segment.path,
    },
  })),
})

const buildUserPoint = (
  location: [number, number] | null,
): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: location
    ? [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: location,
          },
          properties: {},
        },
      ]
    : [],
})

const buildZoneCollection = (
  zones: Zone[],
): FeatureCollection<Polygon | MultiPolygon> => ({
  type: 'FeatureCollection',
  features: zones.map((zone) => ({
    type: 'Feature',
    geometry: zone.polygon.geometry,
    properties: {
      id: zone.id,
      type: zone.type,
      name: zone.name,
      radiusMeters: zone.radiusMeters,
    },
  })),
})

const buildRouteCollection = (
  routeGeometry: [number, number][] | null,
  routeProfile: RouteProfile,
): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features:
    routeGeometry && routeGeometry.length >= 2
      ? [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: routeGeometry,
            },
            properties: {
              profile: routeProfile,
            },
          },
        ]
      : [],
})

const buildSelectedParkingSpaceCollection = (
  markers: SelectedParkingSpaceMarker[],
): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: markers.map((marker) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: marker.anchor,
    },
    properties: {
      key: marker.key,
      shortLabel: marker.shortLabel,
      active: marker.active,
    },
  })),
})

const buildRecommendedParkingTargetCollection = (
  markers: RecommendedParkingTargetMarker[],
): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: markers.map((marker) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: marker.anchor,
    },
    properties: {
      key: marker.key,
      segmentId: marker.segmentId,
      targetKey: marker.targetKey,
      shortLabel: marker.shortLabel,
      active: marker.active,
    },
  })),
})

const fitMapToBounds = (
  map: Map,
  bounds: MapBounds,
  options: {
    padding?: number
    maxZoom?: number
  } = {},
) => {
  map.fitBounds(expandBounds(bounds), {
    padding: options.padding ?? 56,
    maxZoom: options.maxZoom ?? 17.5,
    duration: 700,
    essential: true,
  })
}

export const MapView = ({
  center,
  districtBounds = null,
  districtBoundsKey = null,
  segments,
  zones,
  intersectionZones,
  showZones,
  showIntersectionZones,
  crosswalkZones,
  showCrosswalkZones,
  parkingSpaces,
  showParkingSpaces,
  showInferredCandidates,
  selectedId,
  focusBounds = null,
  focusBoundsKey = null,
  focusCenter = null,
  focusCenterKey = null,
  recommendedSegmentIds = [],
  searchLocation = null,
  searchLocationLabel = null,
  coverageBoundary = null,
  arrivalLocation = null,
  arrivalLocationKind = null,
  arrivalLocationLabel = null,
  recommendedParkingTargetMarkers = [],
  selectedParkingSpaceMarkers = [],
  routeProfile = 'walking',
  routeGeometry = null,
  userLocation,
  onSelect,
  onSelectRecommendedTarget,
  onSelectParkingSpace,
  onPickLocation,
}: MapViewProps) => {
  const mapRef = useRef<Map | null>(null)
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)
  const arrivalMarkerRef = useRef<maplibregl.Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  const onSelectRecommendedTargetRef = useRef(onSelectRecommendedTarget)
  const onSelectParkingSpaceRef = useRef(onSelectParkingSpace)
  const onPickLocationRef = useRef(onPickLocation)
  const showZonesRef = useRef(showZones)
  const showIntersectionZonesRef = useRef(showIntersectionZones)
  const showCrosswalkZonesRef = useRef(showCrosswalkZones)
  const showParkingSpacesRef = useRef(showParkingSpaces)
  const showInferredCandidatesRef = useRef(showInferredCandidates)
  const lastDistrictBoundsKeyRef = useRef<string | null>(null)
  const lastFocusBoundsKeyRef = useRef<string | null>(null)
  const lastFocusCenterKeyRef = useRef<string | null>(null)
  const coverageBoundaryDataRef = useRef(
    coverageBoundary?.data ?? EMPTY_COVERAGE_BOUNDARY_DATA,
  )
  coverageBoundaryDataRef.current =
    coverageBoundary?.data ?? EMPTY_COVERAGE_BOUNDARY_DATA
  const basemapStyle = useMemo(() => createBasemapStyle(), [])

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    onSelectRecommendedTargetRef.current = onSelectRecommendedTarget
  }, [onSelectRecommendedTarget])

  useEffect(() => {
    onSelectParkingSpaceRef.current = onSelectParkingSpace
  }, [onSelectParkingSpace])

  useEffect(() => {
    onPickLocationRef.current = onPickLocation
  }, [onPickLocation])

  useEffect(() => {
    showZonesRef.current = showZones
  }, [showZones])

  useEffect(() => {
    showIntersectionZonesRef.current = showIntersectionZones
  }, [showIntersectionZones])

  useEffect(() => {
    showCrosswalkZonesRef.current = showCrosswalkZones
  }, [showCrosswalkZones])

  useEffect(() => {
    showParkingSpacesRef.current = showParkingSpaces
  }, [showParkingSpaces])

  useEffect(() => {
    showInferredCandidatesRef.current = showInferredCandidates
  }, [showInferredCandidates])

  const recommendedRanks = useMemo(
    () =>
      Object.fromEntries(
        recommendedSegmentIds.map((id, index) => [id, index + 1] as const),
      ),
    [recommendedSegmentIds],
  )
  const segmentsData = useMemo(
    () => buildFeatureCollection(segments, recommendedRanks, showInferredCandidates),
    [recommendedRanks, segments, showInferredCandidates],
  )
  const userData = useMemo(() => buildUserPoint(userLocation), [userLocation])
  const zonesData = useMemo(() => buildZoneCollection(zones), [zones])
  const intersectionZonesData = useMemo(
    () => buildZoneCollection(intersectionZones),
    [intersectionZones],
  )
  const crosswalkZonesData = useMemo(
    () => buildZoneCollection(crosswalkZones),
    [crosswalkZones],
  )
  const emptyParkingSpacesData = useMemo(
    () =>
      ({
        type: 'FeatureCollection',
        features: [],
      }) as FeatureCollection<Geometry>,
    [],
  )
  const parkingSpacesData = useMemo(
    () => (showParkingSpaces ? parkingSpaces : emptyParkingSpacesData),
    [emptyParkingSpacesData, parkingSpaces, showParkingSpaces],
  )
  const routeData = useMemo(
    () => buildRouteCollection(routeGeometry, routeProfile),
    [routeGeometry, routeProfile],
  )
  const recommendedParkingTargetData = useMemo(
    () => buildRecommendedParkingTargetCollection(recommendedParkingTargetMarkers),
    [recommendedParkingTargetMarkers],
  )
  const selectedParkingSpaceData = useMemo(
    () => buildSelectedParkingSpaceCollection(selectedParkingSpaceMarkers),
    [selectedParkingSpaceMarkers],
  )

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: basemapStyle,
      center,
      zoom: 15,
      pitch: 0,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))
    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    map.on('load', () => {
      initializeMapViewContent(map, {
        zonesData,
        coverageBoundaryData: coverageBoundaryDataRef.current,
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
      })
    })

    mapRef.current = map

    return () => {
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = null
      arrivalMarkerRef.current?.remove()
      arrivalMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- center changes are handled by the focus-aware effect below without recreating the map.
  }, [basemapStyle])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!shouldApplyDatasetMapFocus({ focusBoundsKey, focusCenterKey })) {
      return
    }

    map.easeTo({
      center,
      duration: 600,
      essential: true,
    })
  }, [center, focusBoundsKey, focusCenterKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!districtBounds || !districtBoundsKey) {
      lastDistrictBoundsKeyRef.current = null
      return
    }

    if (!shouldApplyDatasetMapFocus({ focusBoundsKey, focusCenterKey })) {
      return
    }

    if (lastDistrictBoundsKeyRef.current === districtBoundsKey) {
      return
    }
    lastDistrictBoundsKeyRef.current = districtBoundsKey

    fitMapToBounds(map, districtBounds, {
      maxZoom: 15.5,
      padding: 60,
    })
  }, [districtBounds, districtBoundsKey, focusBoundsKey, focusCenterKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!focusBounds || !focusBoundsKey) {
      lastFocusBoundsKeyRef.current = null
      return
    }

    if (lastFocusBoundsKeyRef.current === focusBoundsKey) {
      return
    }
    lastFocusBoundsKeyRef.current = focusBoundsKey

    fitMapToBounds(map, focusBounds)
  }, [focusBounds, focusBoundsKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!focusCenter) {
      lastFocusCenterKeyRef.current = null
      return
    }

    const resolvedFocusCenterKey =
      focusCenterKey ?? `${focusCenter[0].toFixed(6)},${focusCenter[1].toFixed(6)}`
    if (lastFocusCenterKeyRef.current === resolvedFocusCenterKey) {
      return
    }
    lastFocusCenterKeyRef.current = resolvedFocusCenterKey

    map.easeTo({
      center: focusCenter,
      duration: 700,
      essential: true,
    })
  }, [focusCenter, focusCenterKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('segments') as GeoJSONSource | undefined
    if (source) {
      source.setData(segmentsData)
    }

    const highlightLayer = map.getLayer('segments-highlight')
    if (highlightLayer) {
      map.setFilter('segments-highlight', ['==', ['get', 'id'], selectedId ?? ''])
    }
  }, [segmentsData, selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('coverage-boundary') as GeoJSONSource | undefined
    if (source) {
      source.setData(coverageBoundaryDataRef.current)
    }
  }, [coverageBoundary])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('zones') as GeoJSONSource | undefined
    if (source) {
      source.setData(zonesData)
    }
  }, [zonesData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('intersection-zones') as GeoJSONSource | undefined
    if (source) {
      source.setData(intersectionZonesData)
    }
  }, [intersectionZonesData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('crosswalk-zones') as GeoJSONSource | undefined
    if (source) {
      source.setData(crosswalkZonesData)
    }
  }, [crosswalkZonesData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('parking-spaces') as GeoJSONSource | undefined
    if (source) {
      source.setData(parkingSpacesData)
    }
  }, [parkingSpacesData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const visibility = showZones ? 'visible' : 'none'
    if (map.getLayer('zones-fill')) {
      map.setLayoutProperty('zones-fill', 'visibility', visibility)
    }
    if (map.getLayer('zones-outline')) {
      map.setLayoutProperty('zones-outline', 'visibility', visibility)
    }
  }, [showZones])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const visibility = showIntersectionZones ? 'visible' : 'none'
    if (map.getLayer('intersection-fill')) {
      map.setLayoutProperty('intersection-fill', 'visibility', visibility)
    }
    if (map.getLayer('intersection-outline')) {
      map.setLayoutProperty('intersection-outline', 'visibility', visibility)
    }
  }, [showIntersectionZones])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const visibility = showCrosswalkZones ? 'visible' : 'none'
    if (map.getLayer('crosswalk-fill')) {
      map.setLayoutProperty('crosswalk-fill', 'visibility', visibility)
    }
    if (map.getLayer('crosswalk-outline')) {
      map.setLayoutProperty('crosswalk-outline', 'visibility', visibility)
    }
  }, [showCrosswalkZones])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const visibility = showParkingSpaces ? 'visible' : 'none'
    if (map.getLayer('parking-spaces-fill')) {
      map.setLayoutProperty('parking-spaces-fill', 'visibility', visibility)
    }
    if (map.getLayer('parking-spaces-line')) {
      map.setLayoutProperty('parking-spaces-line', 'visibility', visibility)
    }
    if (map.getLayer('parking-spaces-point')) {
      map.setLayoutProperty('parking-spaces-point', 'visibility', visibility)
    }
  }, [showParkingSpaces])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const visibility = showInferredCandidates ? 'visible' : 'none'
    if (map.getLayer('segments-inferred')) {
      map.setLayoutProperty('segments-inferred', 'visibility', visibility)
    }
  }, [showInferredCandidates])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('user-location') as GeoJSONSource | undefined
    if (source) {
      source.setData(userData)
    }
  }, [userData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('selected-route') as GeoJSONSource | undefined
    if (source) {
      source.setData(routeData)
    }
  }, [routeData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('recommended-targets') as GeoJSONSource | undefined
    if (source) {
      source.setData(recommendedParkingTargetData)
    }
  }, [recommendedParkingTargetData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const source = map.getSource('selected-space-options') as GeoJSONSource | undefined
    if (source) {
      source.setData(selectedParkingSpaceData)
    }
  }, [selectedParkingSpaceData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!searchLocation) {
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = null
      return
    }

    if (!searchMarkerRef.current) {
      const markerElement = document.createElement('div')
      markerElement.className = 'map-search-marker'

      const markerLabel = document.createElement('div')
      markerLabel.className = 'map-search-label'
      markerElement.appendChild(markerLabel)

      const markerPin = document.createElement('div')
      markerPin.className = 'map-search-pin'
      markerElement.appendChild(markerPin)

      searchMarkerRef.current = new maplibregl.Marker({
        element: markerElement,
        anchor: 'bottom',
        offset: [0, 6],
      })
    }

    const marker = searchMarkerRef.current
    const markerElement = marker.getElement()
    const markerLabel = markerElement.querySelector('.map-search-label')
    if (markerLabel) {
      markerLabel.textContent = searchLocationLabel ?? 'Address result'
    }
    markerElement.setAttribute('title', searchLocationLabel ?? 'Address result')
    marker.setLngLat(searchLocation).addTo(map)
  }, [searchLocation, searchLocationLabel])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!arrivalLocation) {
      arrivalMarkerRef.current?.remove()
      arrivalMarkerRef.current = null
      return
    }

    if (!arrivalMarkerRef.current) {
      const markerElement = document.createElement('div')
      markerElement.className = 'map-arrival-marker'

      const markerLabel = document.createElement('div')
      markerLabel.className = 'map-arrival-label'
      markerElement.appendChild(markerLabel)

      const markerPin = document.createElement('div')
      markerPin.className = 'map-arrival-pin'
      markerElement.appendChild(markerPin)

      arrivalMarkerRef.current = new maplibregl.Marker({
        element: markerElement,
        anchor: 'bottom',
        offset: [0, 6],
      })
    }

    const marker = arrivalMarkerRef.current
    const markerElement = marker.getElement()
    const markerLabel = markerElement.querySelector('.map-arrival-label')
    markerElement.classList.toggle('space-target', arrivalLocationKind === 'PARKING_SPACE')
    if (markerLabel) {
      markerLabel.textContent = arrivalLocationLabel ?? 'Arrival target'
    }
    markerElement.setAttribute('title', arrivalLocationLabel ?? 'Arrival target')
    marker.setLngLat(arrivalLocation).addTo(map)
  }, [arrivalLocation, arrivalLocationKind, arrivalLocationLabel])

  return (
    <div
      className="map-root-shell"
      data-parking-space-count={parkingSpaces.features.length}
      data-segment-count={segments.length}
      data-zone-count={zones.length}
      data-coverage-district={coverageBoundary?.districtId ?? undefined}
      data-coverage-stage={coverageBoundary?.publishStage ?? undefined}
    >
      <div ref={mapContainer} className="map-root" />
      <div className="map-overlay-controls">
        {coverageBoundary ? (
          <div
            className={`map-coverage-status ${coverageBoundary.publishStage}`}
            aria-label={`${coverageBoundary.districtName} coverage boundary: ${coverageBoundary.stageLabel}`}
          >
            <span className="map-coverage-status-dot" aria-hidden="true" />
            <span>
              <strong>{coverageBoundary.districtName}</strong> boundary -{' '}
              {coverageBoundary.stageLabel}
            </span>
          </div>
        ) : null}
        <div className="map-click-hint">Click map to check parking here</div>
        <button
          type="button"
          className="map-action-button"
          onClick={() => {
            const map = mapRef.current
            if (!map || !userLocation) {
              return
            }
            map.easeTo({
              center: userLocation,
              zoom: Math.max(map.getZoom(), 16),
              duration: 650,
              essential: true,
            })
          }}
          disabled={!userLocation}
          title="Center on current location"
        >
          My location
        </button>
      </div>
    </div>
  )
}
