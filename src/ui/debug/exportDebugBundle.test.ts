import { describe, expect, it } from 'vitest'
import type { FeatureCollection, LineString, MultiLineString, Point } from 'geojson'
import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
  type DatasetMeta,
} from '../../data/segmentBuilder'
import { getDatasetBaseDir } from '../../data/datasetResolver'
import { loadGeoJson } from '../../data/loaders/loadGeoJson.node'
import { evaluateSegmentWithZones } from '../../domain/rules/evaluateSegment'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from '../../domain/zones/makeZones'
import { getZoneIndex } from '../../domain/zones/zoneIndex'
import { MOCK_LOCATION } from '../../map/geo'
import { buildDebugBundle } from './exportDebugBundle'

describe('exportDebugBundle', () => {
  it('builds bundle with required fields', async () => {
    const baseDir = getDatasetBaseDir()
    const [
      redYellow,
      busStops,
      hydrants,
      intersections,
      crosswalks,
      signOverrides,
      inferredCandidates,
      meta,
    ] = await Promise.all([
      loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
        'red_yellow.geojson',
        { baseDir },
      ),
      loadGeoJson<FeatureCollection<Point>>('bus_stops.geojson', { baseDir }),
      loadGeoJson<FeatureCollection<Point>>('hydrants.geojson', { baseDir }),
      loadGeoJson<FeatureCollection<Point>>('intersections.geojson', { baseDir }),
      loadGeoJson<FeatureCollection>('crosswalks.geojson', { baseDir }),
      loadGeoJson<FeatureCollection>('sign_overrides.geojson', { baseDir }),
      loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
        'candidates_inferred.geojson',
        { baseDir },
      ),
      loadGeoJson<DatasetMeta>('dataset_meta.json', { baseDir }),
    ])

    const baseSegments = redYellow.features.flatMap((feature, index) =>
      buildSegmentsFromFeature(feature, index, meta),
    )
    const inferredSegments = inferredCandidates.features.flatMap((feature, index) =>
      buildInferredSegmentsFromFeature(feature, index, meta),
    )
    const matchTolerance = meta?.signOverrideMatchToleranceMeters ?? 15
    const segments = applySignOverrides(
      [...baseSegments, ...inferredSegments],
      signOverrides,
      {
        matchToleranceMeters: matchTolerance,
      },
    )

    const zones = makeZonesFromPOIs(busStops, hydrants, intersections, crosswalks)
    const zoneIndex = getZoneIndex(zones, meta?.datasetHash ?? 'local', ZONE_PARAMS_VERSION)
    const evaluated = segments.flatMap((segment) =>
      evaluateSegmentWithZones(segment, '13:00', zoneIndex),
    )

    const selectedSegment = evaluated[0] ?? null
    const bundle = buildDebugBundle({
      meta,
      hhmm: '13:00',
      includeInferred: false,
      selectedSegment,
      userLocation: MOCK_LOCATION,
      zoneIndex,
    })

    expect(bundle.pack.meta).not.toBeNull()
    expect(bundle.context.hhmm).toBe('13:00')
    expect(bundle.context.includeInferred).toBe(false)
    expect(bundle.selectedSegment?.id).toBeDefined()
    expect(bundle.selectedSegment?.name).toBeDefined()
    expect(bundle.selectedSegment?.reasons).toBeDefined()
    expect(bundle.selectedSegment?.reasonCodes).toBeDefined()
    expect(bundle.ranking.distanceMeters).not.toBeNull()
    expect(bundle.ranking.breakdown?.total).toBeDefined()
    expect(bundle.nearbyZones.length).toBe(2)
    expect(bundle.nearbyZones[0]?.radiusMeters).toBe(30)
    expect(bundle.nearbyZones[1]?.radiusMeters).toBe(50)
  })
})
