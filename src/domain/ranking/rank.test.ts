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
import { evaluateSegmentWithZones } from '../rules/evaluateSegment'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from '../zones/makeZones'
import { getZoneIndex } from '../zones/zoneIndex'
import { distanceMeters, getPathMidpoint, MOCK_LOCATION } from '../../map/geo'
import { applyRankingPolicy } from './policy'

describe('ranking', () => {
  it('orders segments deterministically for fixture dataset', async () => {
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

    const withDistance = evaluated.map((segment) => ({
      ...segment,
      distanceMeters: distanceMeters(MOCK_LOCATION, getPathMidpoint(segment.path)),
    }))
    const ranked = applyRankingPolicy(withDistance, { includeInferred: true })
    const orderedIds = ranked.map((segment) => segment.id)

    expect(orderedIds).toEqual([
      'seg-3-part-1',
      'seg-3-part-3',
      'seg-1-part-7',
      'seg-1-part-1',
      'seg-4',
      'seg-3-part-2',
      'seg-2-part-3',
      'seg-2-part-2',
      'seg-2-part-1',
      'cand-1-R',
      'seg-1-part-6',
      'seg-1-part-5',
      'seg-1-part-4',
      'seg-1-part-3',
      'seg-1-part-2',
      'cand-1-L',
    ])

    const rankedOfficialOnly = applyRankingPolicy(withDistance, {
      includeInferred: false,
    })
    const officialIds = rankedOfficialOnly.map((segment) => segment.id)

    expect(officialIds.includes('cand-1-L')).toBe(false)
    expect(officialIds.includes('cand-1-R')).toBe(false)
  })
})
