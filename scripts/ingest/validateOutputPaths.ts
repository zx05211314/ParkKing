import * as path from 'node:path'
import { getBoundaryFileName } from './ingestDistrictPaths'
import type { ResolvedConfig } from './readConfig'

export interface ValidateOutputPaths {
  baseDir: string
  boundaryFile: string
  boundaryPath: string
  redYellowPath: string
  busStopsPath: string
  hydrantsPath: string
  parkingSpacesPath: string
  intersectionsPath: string
  crosswalksPath: string
  signOverridesPath: string
  overridesAppliedPath: string
  inferredCandidatesPath: string
  intersectionsReportPath: string
  metaPath: string
}

export const resolveValidateOutputPaths = (
  config: ResolvedConfig,
): ValidateOutputPaths => {
  const baseDir = config.outputs.generatedDir
  const boundaryFile = getBoundaryFileName(config.districtId)
  return {
    baseDir,
    boundaryFile,
    boundaryPath: path.resolve(baseDir, boundaryFile),
    redYellowPath: path.resolve(baseDir, 'red_yellow.geojson'),
    busStopsPath: path.resolve(baseDir, 'bus_stops.geojson'),
    hydrantsPath: path.resolve(baseDir, 'hydrants.geojson'),
    parkingSpacesPath: path.resolve(baseDir, 'parking_spaces.geojson'),
    intersectionsPath: path.resolve(baseDir, 'intersections.geojson'),
    crosswalksPath: path.resolve(baseDir, 'crosswalks.geojson'),
    signOverridesPath: path.resolve(baseDir, 'sign_overrides.geojson'),
    overridesAppliedPath: path.resolve(baseDir, 'overrides_applied.geojson'),
    inferredCandidatesPath: path.resolve(baseDir, 'candidates_inferred.geojson'),
    intersectionsReportPath: path.resolve(baseDir, 'intersections_report.json'),
    metaPath: path.resolve(baseDir, 'dataset_meta.json'),
  }
}
