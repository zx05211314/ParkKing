import * as path from 'node:path'
import { getBoundaryFileName } from './ingestDistrictPaths'
import { readGeoJsonFeatureCount } from './ingestDatasetMetaReaders'

export const resolveDatasetMetaPaths = (generatedDir: string, districtId: string) => {
  return {
    boundary: path.resolve(generatedDir, getBoundaryFileName(districtId)),
    redYellow: path.resolve(generatedDir, 'red_yellow.geojson'),
    busStops: path.resolve(generatedDir, 'bus_stops.geojson'),
    hydrants: path.resolve(generatedDir, 'hydrants.geojson'),
    parkingSpaces: path.resolve(generatedDir, 'parking_spaces.geojson'),
    intersections: path.resolve(generatedDir, 'intersections.geojson'),
    crosswalks: path.resolve(generatedDir, 'crosswalks.geojson'),
    signOverrides: path.resolve(generatedDir, 'sign_overrides.geojson'),
    overridesApplied: path.resolve(generatedDir, 'overrides_applied.geojson'),
    inferredCandidates: path.resolve(generatedDir, 'candidates_inferred.geojson'),
  }
}

export const readDatasetMetaCounts = async (
  paths: ReturnType<typeof resolveDatasetMetaPaths>,
) => {
  const [
    segments,
    busStops,
    hydrants,
    parkingSpaces,
    intersections,
    crosswalks,
    signOverrides,
    overridesApplied,
    inferredCandidates,
  ] = await Promise.all([
    readGeoJsonFeatureCount(paths.redYellow),
    readGeoJsonFeatureCount(paths.busStops),
    readGeoJsonFeatureCount(paths.hydrants),
    readGeoJsonFeatureCount(paths.parkingSpaces),
    readGeoJsonFeatureCount(paths.intersections),
    readGeoJsonFeatureCount(paths.crosswalks),
    readGeoJsonFeatureCount(paths.signOverrides),
    readGeoJsonFeatureCount(paths.overridesApplied),
    readGeoJsonFeatureCount(paths.inferredCandidates),
  ])

  return {
    segments,
    busStops,
    hydrants,
    parkingSpaces,
    intersections,
    crosswalks,
    signOverrides,
    overridesApplied,
    inferredCandidates,
  }
}
