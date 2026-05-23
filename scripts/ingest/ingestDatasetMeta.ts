import * as path from 'node:path'
import type { ResolvedConfig } from './readConfig'
import { hashFiles, PACK_FILE_LIST } from './hashFiles'
import { bboxFromCollection, centerFromBBox } from './ingestGeoBounds'
import { resolveDatasetMetaPaths, readDatasetMetaCounts } from './ingestDatasetMetaFiles'
import { buildDatasetMetaResult } from './ingestDatasetMetaResult'
import {
  buildQualityMetrics,
  countRiskTags,
} from './ingestDatasetQualityMetrics'
import {
  readGeoJsonCollection,
  readIntersectionsReport,
  readProvenanceFetchedAt,
  resolveSignOverridesFreshness,
} from './ingestDatasetMetaReaders'

export const buildDatasetMeta = async (config: ResolvedConfig) => {
  const districtName =
    config.districtName ?? config.districtId ?? path.basename(config.outputs.generatedDir)
  const fileHashes = await hashFiles(config.outputs.generatedDir, PACK_FILE_LIST)
  const paths = resolveDatasetMetaPaths(config.outputs.generatedDir, config.districtId)
  const counts = await readDatasetMetaCounts(paths)

  const redYellowCollection = await readGeoJsonCollection(paths.redYellow)
  const parkingSpaceCollection = await readGeoJsonCollection(paths.parkingSpaces)
  const intersectionCollection = await readGeoJsonCollection(paths.intersections)
  const crosswalkCollection = await readGeoJsonCollection(paths.crosswalks)
  const signOverrideCollection = await readGeoJsonCollection(paths.signOverrides)
  const inferredCollection = await readGeoJsonCollection(paths.inferredCandidates)
  const boundaryCollection = await readGeoJsonCollection(paths.boundary)

  const parkingSpacesBBox = parkingSpaceCollection
    ? bboxFromCollection(parkingSpaceCollection)
    : null
  const intersectionsBBox = intersectionCollection
    ? bboxFromCollection(intersectionCollection)
    : null
  const crosswalksBBox = crosswalkCollection
    ? bboxFromCollection(crosswalkCollection)
    : null
  const signOverridesBBox = signOverrideCollection
    ? bboxFromCollection(signOverrideCollection)
    : null
  const inferredCandidatesBBox = inferredCollection
    ? bboxFromCollection(inferredCollection)
    : null
  const boundaryBBox = boundaryCollection ? bboxFromCollection(boundaryCollection) : null
  const boundaryCenter = centerFromBBox(boundaryBBox)
  const inferredRiskCounts = countRiskTags(inferredCollection)
  const provenanceFetchedAt = await readProvenanceFetchedAt(config)
  const qualityMetrics = buildQualityMetrics(
    redYellowCollection,
    signOverrideCollection,
    config.signOverrides.matchToleranceMeters,
    inferredCollection,
  )
  const intersectionsReport = await readIntersectionsReport(config.outputs.generatedDir)
  const { signOverridesUpdatedAt, signOverridesFreshnessDays } =
    resolveSignOverridesFreshness(config)

  return buildDatasetMetaResult({
    config,
    counts,
    districtName,
    fileHashes,
    parkingSpacesBBox,
    intersectionsBBox,
    crosswalksBBox,
    signOverridesBBox,
    inferredCandidatesBBox,
    boundaryBBox,
    boundaryCenter,
    inferredRiskCounts,
    provenanceFetchedAt,
    qualityMetrics,
    intersectionsReport,
    signOverridesUpdatedAt,
    signOverridesFreshnessDays,
  })
}
