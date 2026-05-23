import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from 'geojson'
import { loadGeoJson } from '../data/loaders/loadGeoJson'
import { loadText } from '../data/loaders/loadText.browser'
import type { DatasetMeta } from '../data/segmentBuilder'
import type { ParkingSpaceCollection } from '../data/parkingSpaces'
import type {
  DatasetManifest,
  IngestReport,
  LatestPointer,
} from './datasetInfo/model'

export interface DatasetArtifacts {
  redYellow: FeatureCollection<LineString | MultiLineString>
  busStops: FeatureCollection<Point>
  hydrants: FeatureCollection<Point>
  parkingSpaces: ParkingSpaceCollection
  intersections: FeatureCollection<Point>
  crosswalks: FeatureCollection
  signOverrides: FeatureCollection
  inferredCandidates: FeatureCollection<LineString | MultiLineString>
  meta: DatasetMeta | null
}

export interface DatasetSupplementalInfo {
  latest: LatestPointer | null
  manifest: DatasetManifest | null
  report: IngestReport | null
  history: string | null
}

export const DATASET_FILES = {
  redYellow: 'red_yellow.geojson',
  busStops: 'bus_stops.geojson',
  hydrants: 'hydrants.geojson',
  parkingSpaces: 'parking_spaces.geojson',
  intersections: 'intersections.geojson',
  crosswalks: 'crosswalks.geojson',
  signOverrides: 'sign_overrides.geojson',
  inferredCandidates: 'candidates_inferred.geojson',
  meta: 'dataset_meta.json',
}

export const loadDatasetArtifacts = async (
  baseDir: string,
): Promise<DatasetArtifacts> => {
  const [
    redYellow,
    busStops,
    hydrants,
    parkingSpaces,
    intersections,
    crosswalks,
    signOverrides,
    inferredCandidates,
    meta,
  ] = await Promise.all([
    loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
      DATASET_FILES.redYellow,
      { baseDir },
    ),
    loadGeoJson<FeatureCollection<Point>>(DATASET_FILES.busStops, { baseDir }),
    loadGeoJson<FeatureCollection<Point>>(DATASET_FILES.hydrants, { baseDir }),
    loadGeoJson<ParkingSpaceCollection>(DATASET_FILES.parkingSpaces, { baseDir }).catch(
      () =>
        ({
          type: 'FeatureCollection',
          features: [],
        } as ParkingSpaceCollection),
    ),
    loadGeoJson<FeatureCollection<Point>>(DATASET_FILES.intersections, { baseDir }),
    loadGeoJson<FeatureCollection>(DATASET_FILES.crosswalks, { baseDir }).catch(
      () => ({ type: 'FeatureCollection', features: [] } as FeatureCollection),
    ),
    loadGeoJson<FeatureCollection>(DATASET_FILES.signOverrides, { baseDir }).catch(
      () => ({ type: 'FeatureCollection', features: [] } as FeatureCollection),
    ),
    loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
      DATASET_FILES.inferredCandidates,
      { baseDir },
    ).catch(
      () =>
        ({
          type: 'FeatureCollection',
          features: [],
        } as FeatureCollection<LineString | MultiLineString>),
    ),
    loadGeoJson<DatasetMeta>(DATASET_FILES.meta, { baseDir }).catch(() => null),
  ])

  return {
    redYellow,
    busStops,
    hydrants,
    parkingSpaces,
    intersections,
    crosswalks,
    signOverrides,
    inferredCandidates,
    meta,
  }
}

export const loadDatasetSupplementalInfo = async (
  baseDir: string,
  datasetId: string,
): Promise<DatasetSupplementalInfo> => {
  const latest = await loadGeoJson<LatestPointer>('LATEST.json', {
    baseDir,
  }).catch(() => null)

  const rootBase = baseDir.replace(/\/+$/g, '')
  const rootDir = rootBase.endsWith(`/${datasetId}`)
    ? rootBase.slice(0, -(`/${datasetId}`).length)
    : baseDir
  const manifestPath = latest?.manifestPath
    ? latest.manifestPath.replace(/^\/+/, '')
    : null

  const manifest = manifestPath
    ? await loadGeoJson<DatasetManifest>(manifestPath, {
        baseDir: rootDir,
      }).catch(() => null)
    : null

  const report = await loadGeoJson<IngestReport>('ingest_all_report.json', {
    baseDir: rootDir,
  }).catch(() => null)

  let history = await loadText('metrics_history.jsonl', {
    baseDir,
  }).catch(() => null)
  if (!history && rootDir && rootDir !== baseDir) {
    const legacyHistory = await loadText('metrics_history.jsonl', {
      baseDir: rootDir,
    }).catch(() => null)
    if (legacyHistory) {
      console.warn('metrics_history.jsonl loaded from pack root (legacy).')
      history = legacyHistory
    }
  }

  return {
    latest,
    manifest,
    report,
    history,
  }
}

export const verifyLatestDatasetHash = async (
  baseDir: string,
  datasetHash?: string,
) => {
  if (!datasetHash) {
    return
  }
  try {
    const latest = await loadGeoJson<LatestPointer>('LATEST.json', {
      baseDir,
    })
    if (latest?.datasetHash && latest.datasetHash !== datasetHash) {
      throw new Error(
        `Pack out of sync: meta ${datasetHash} vs LATEST ${latest.datasetHash}`,
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Pack out of sync:')) {
      throw error
    }
    // Missing LATEST.json is acceptable.
  }
}
