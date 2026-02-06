import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { Map, GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString, MultiPolygon, Point, Polygon } from 'geojson'
import type { EvaluatedSegment } from '../ui/types'
import type { Zone } from '../domain/zones/zoneTypes'

export interface MapViewProps {
  center: [number, number]
  segments: EvaluatedSegment[]
  zones: Zone[]
  intersectionZones: Zone[]
  showZones: boolean
  showIntersectionZones: boolean
  crosswalkZones: Zone[]
  showCrosswalkZones: boolean
  showInferredCandidates: boolean
  selectedId: string | null
  userLocation: [number, number] | null
  onSelect: (id: string | null) => void
}

const styleBase: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0f1116',
      },
    },
  ],
}

const buildFeatureCollection = (
  segments: EvaluatedSegment[],
): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: segments.map((segment) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: segment.path,
    },
    properties: {
      id: segment.id,
      tier: segment.tier,
      allowedNow: segment.allowedNow,
      name: segment.name,
      curbMarking: segment.curbMarking,
      sourceType: segment.sourceType ?? 'CURB',
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

export const MapView = ({
  center,
  segments,
  zones,
  intersectionZones,
  showZones,
  showIntersectionZones,
  crosswalkZones,
  showCrosswalkZones,
  showInferredCandidates,
  selectedId,
  userLocation,
  onSelect,
}: MapViewProps) => {
  const mapRef = useRef<Map | null>(null)
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const onSelectRef = useRef(onSelect)
  const showZonesRef = useRef(showZones)
  const showIntersectionZonesRef = useRef(showIntersectionZones)
  const showCrosswalkZonesRef = useRef(showCrosswalkZones)
  const showInferredCandidatesRef = useRef(showInferredCandidates)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

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
    showInferredCandidatesRef.current = showInferredCandidates
  }, [showInferredCandidates])

  const segmentsData = useMemo(() => buildFeatureCollection(segments), [segments])
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

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleBase,
      center,
      zoom: 15,
      pitch: 0,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))

    map.on('load', () => {
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

      map.on('mouseenter', 'segments-line', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'segments-line', () => {
        map.getCanvas().style.cursor = ''
      })

      map.on('mouseenter', 'segments-inferred', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'segments-inferred', () => {
        map.getCanvas().style.cursor = ''
      })

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

      map.on('click', (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['segments-line', 'segments-inferred'],
        })
        if (features.length === 0) {
          onSelectRef.current(null)
        }
      })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- map instance is initialized once; follow-up effects update layer data.
  }, [center])

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

  return <div ref={mapContainer} className="map-root" />
}
