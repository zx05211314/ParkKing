import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { TextDecoder } from 'node:util'
import { booleanIntersects, featureCollection, point } from '@turf/turf'
import * as shapefile from 'shapefile'
import proj4 from 'proj4'
import { parse } from 'csv-parse/sync'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson'
import type { ResolvedConfig } from './readConfig'
import { hashFiles, PACK_FILE_LIST } from './hashFiles'
import {
  applySignOverrides,
  buildSegmentsFromFeature,
} from '../../src/data/segmentBuilder'
import { evaluateSegment } from '../../src/domain/rules/evaluateSegment'

export const EPSG_3826 = 'EPSG:3826'
export const EPSG_4326 = 'EPSG:4326'

const METRICS_SCHEMA_VERSION = 1
const METRICS_SAMPLE_HHMM = '13:00'

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

proj4.defs(
  EPSG_3826,
  '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs',
)

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const daysSince = (timestampMs: number) => {
  const diffMs = Date.now() - timestampMs
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

export const normalizeDistrictId = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) {
    return 'district'
  }
  const dashed = trimmed.replace(/[\s_]+/g, '-')
  const normalized = dashed.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  return normalized.replace(/^-+|-+$/g, '') || 'district'
}

export const getBoundaryFileName = (districtId: string) => {
  const slug = normalizeDistrictId(districtId)
  return `${slug}_boundary.geojson`
}

export const ensureDirs = async (config: ResolvedConfig) => {
  await fs.mkdir(config.outputs.generatedDir, { recursive: true })
  await fs.mkdir(config.outputs.publicDir, { recursive: true })
}

const detectCrsFromPrj = (prj: string | null, fallback: string): string => {
  if (!prj) {
    return fallback
  }

  const normalized = prj.toLowerCase()
  if (normalized.includes('wgs_1984') || normalized.includes('wgs 84')) {
    return EPSG_4326
  }
  if (normalized.includes('twd97') || normalized.includes('twd_1997')) {
    return EPSG_3826
  }

  return fallback
}

const transformCoord = (coord: number[], from: string): [number, number] => {
  if (from === EPSG_4326) {
    return [coord[0], coord[1]]
  }
  const [x, y] = proj4(from, EPSG_4326, coord)
  return [x, y]
}

const transformGeometry = (geometry: Geometry, from: string): Geometry => {
  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: transformCoord(geometry.coordinates, from),
      }
    case 'MultiPoint':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((coord) =>
          transformCoord(coord, from),
        ),
      }
    case 'LineString':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((coord) =>
          transformCoord(coord, from),
        ),
      }
    case 'MultiLineString':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((line) =>
          line.map((coord) => transformCoord(coord, from)),
        ),
      }
    case 'Polygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) =>
          ring.map((coord) => transformCoord(coord, from)),
        ),
      }
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((poly) =>
          poly.map((ring) => ring.map((coord) => transformCoord(coord, from))),
        ),
      }
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map((geom) =>
          transformGeometry(geom, from),
        ),
      }
    default:
      return geometry
  }
}

const collectCoords = (coords: unknown, result: [number, number][]) => {
  if (!Array.isArray(coords)) {
    return
  }

  if (
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    result.push([coords[0], coords[1]])
    return
  }

  coords.forEach((entry) => collectCoords(entry, result))
}

const bboxFromGeometry = (geometry: Geometry): BBox | null => {
  const coords: [number, number][] = []
  collectCoords(geometry.coordinates, coords)

  if (coords.length === 0) {
    return null
  }

  const xs = coords.map((c) => c[0])
  const ys = coords.map((c) => c[1])

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

const mergeBBoxes = (a: BBox | null, b: BBox | null): BBox | null => {
  if (!a) {
    return b
  }
  if (!b) {
    return a
  }
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

const bboxFromCollection = (collection: FeatureCollection): BBox | null => {
  return collection.features.reduce<BBox | null>((current, feature) => {
    if (!feature.geometry) {
      return current
    }
    const bbox = bboxFromGeometry(feature.geometry)
    return mergeBBoxes(current, bbox)
  }, null)
}

const centerFromBBox = (bbox: BBox | null): [number, number] | null => {
  if (!bbox) {
    return null
  }
  return [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2]
}

const normalizeFeatures = (
  collection: FeatureCollection,
  sourceCrs: string,
): FeatureCollection => {
  if (sourceCrs === EPSG_4326) {
    return collection
  }

  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      geometry: feature.geometry
        ? transformGeometry(feature.geometry, sourceCrs)
        : null,
    })),
  }
}

const sampleCoordFromGeometry = (geometry: Geometry): [number, number] | null => {
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const sample = sampleCoordFromGeometry(child)
      if (sample) {
        return sample
      }
    }
    return null
  }
  const coords: [number, number][] = []
  collectCoords(
    (geometry as Geometry & { coordinates?: unknown }).coordinates ?? null,
    coords,
  )
  return coords[0] ?? null
}

const sampleCoordFromCollection = (collection: FeatureCollection): [number, number] | null => {
  for (const feature of collection.features) {
    if (!feature.geometry) {
      continue
    }
    const sample = sampleCoordFromGeometry(feature.geometry)
    if (sample) {
      return sample
    }
  }
  return null
}

const isLikelyLngLat = (coord: [number, number] | null) => {
  if (!coord) {
    return false
  }
  return Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90
}

const parseCoordPair = (value: string): [number, number] | null => {
  const tokens = value.trim().split(/[\s,]+/)
  if (tokens.length < 2) {
    return null
  }
  const lon = Number(tokens[0])
  const lat = Number(tokens[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }
  return [lon, lat]
}

const parseLineStringCoords = (value: string): [number, number][] => {
  return value
    .split(',')
    .map((entry) => parseCoordPair(entry))
    .filter((coord): coord is [number, number] => Boolean(coord))
}

const parseWktGeometry = (value: string): Geometry | null => {
  const trimmed = value.trim()
  const upper = trimmed.toUpperCase()

  if (upper.startsWith('POINT')) {
    const body = trimmed.replace(/POINT\s*/i, '').replace(/[()]/g, '').trim()
    const coord = parseCoordPair(body)
    if (!coord) {
      return null
    }
    return { type: 'Point', coordinates: coord }
  }

  if (upper.startsWith('LINESTRING')) {
    const body = trimmed.replace(/LINESTRING\s*/i, '').replace(/[()]/g, '').trim()
    const coords = parseLineStringCoords(body)
    if (coords.length < 2) {
      return null
    }
    return { type: 'LineString', coordinates: coords }
  }

  if (upper.startsWith('MULTILINESTRING')) {
    let body = trimmed.replace(/MULTILINESTRING\s*/i, '').trim()
    body = body.replace(/^\(\(/, '').replace(/\)\)$/, '')
    const lines = body
      .split(/\)\s*,\s*\(/)
      .map((segment) => parseLineStringCoords(segment))
      .filter((coords) => coords.length >= 2)
    if (lines.length === 0) {
      return null
    }
    return { type: 'MultiLineString', coordinates: lines }
  }

  return null
}

const shouldTransform = (geometry: Geometry) => {
  const coords: [number, number][] = []
  collectCoords(geometry.coordinates, coords)
  if (coords.length === 0) {
    return false
  }
  const [lon, lat] = coords[0]
  return Math.abs(lon) > 180 || Math.abs(lat) > 90
}

const parseCsv = (
  csvText: string,
  defaultCrs: string,
): FeatureCollection => {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
  }) as Record<string, string>[]

  if (records.length === 0) {
    return featureCollection([])
  }

  const headerKeys = Object.keys(records[0] ?? {})
  const keyLookup = headerKeys.map((key) => ({
    key,
    normalized: key.toLowerCase().replace(/\s+/g, ''),
  }))
  const findKey = (candidates: string[]) => {
    const normalizedCandidates = candidates.map((candidate) =>
      candidate.toLowerCase().replace(/\s+/g, ''),
    )
    const hit = keyLookup.find((entry) =>
      normalizedCandidates.some((candidate) => entry.normalized === candidate),
    )
    return hit?.key ?? null
  }
  const findKeyByPattern = (patterns: RegExp[]) => {
    const hit = keyLookup.find((entry) =>
      patterns.some((pattern) => pattern.test(entry.key) || pattern.test(entry.normalized)),
    )
    return hit?.key ?? null
  }

  const latKey = findKey(['lat', 'latitude', 'lat_wgs84', 'y_wgs84'])
    ?? findKeyByPattern([
      /wgs\s*84.*(lat|latitude|緯度|纬度)/iu,
      /(lat|latitude|緯度|纬度)/iu,
    ])
  const lonKey = findKey(['lon', 'lng', 'longitude', 'lon_wgs84', 'x_wgs84'])
    ?? findKeyByPattern([
      /wgs\s*84.*(lon|lng|longitude|經度|经度)/iu,
      /(lon|lng|longitude|經度|经度)/iu,
    ])
  const xKey = findKey(['x', 'tm2_x', 'twd97_x', 'x_twd97'])
    ?? findKeyByPattern([/(tm2|twd97|97).*x/iu, /x座標|x坐标/iu])
  const yKey = findKey(['y', 'tm2_y', 'twd97_y', 'y_twd97'])
    ?? findKeyByPattern([/(tm2|twd97|97).*y/iu, /y座標|y坐标/iu])
  const wktKey = findKey(['wkt', 'geometry', 'geom'])

  const features: Feature[] = []

  records.forEach((record, index) => {
    if (wktKey && record[wktKey]) {
      const geometry = parseWktGeometry(record[wktKey])
      if (!geometry) {
        return
      }
      const transformed = shouldTransform(geometry)
        ? transformGeometry(geometry, defaultCrs)
        : geometry
      features.push({
        type: 'Feature',
        geometry: transformed,
        properties: { ...record, _row: index + 1 },
      })
      return
    }

    if (latKey && lonKey) {
      const lat = Number(record[latKey])
      const lon = Number(record[lonKey])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return
      }
      features.push({
        type: 'Feature',
        geometry: point([lon, lat]).geometry,
        properties: { ...record, _row: index + 1 },
      })
      return
    }

    if (xKey && yKey) {
      const x = Number(record[xKey])
      const y = Number(record[yKey])
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return
      }
      const [lon, lat] = transformCoord([x, y], defaultCrs)
      features.push({
        type: 'Feature',
        geometry: point([lon, lat]).geometry,
        properties: { ...record, _row: index + 1 },
      })
    }
  })

  return featureCollection(features)
}

export const readDataset = async (
  inputPath: string,
  defaultCrs: string,
): Promise<FeatureCollection> => {
  const ext = path.extname(inputPath).toLowerCase()

  if (ext === '.geojson' || ext === '.json') {
    const raw = await fs.readFile(inputPath, 'utf-8')
    const sanitized = raw.replace(/^\uFEFF/, '')
    const collection = JSON.parse(sanitized) as FeatureCollection
    const firstCoord = collection.features.find((feature) => feature.geometry)?.geometry
    const coordSample = (() => {
      if (!firstCoord) {
        return null
      }
      if (firstCoord.type === 'Point') {
        return firstCoord.coordinates
      }
      if (firstCoord.type === 'LineString') {
        return firstCoord.coordinates[0]
      }
      if (firstCoord.type === 'Polygon') {
        return firstCoord.coordinates[0]?.[0]
      }
      if (firstCoord.type === 'MultiPoint') {
        return firstCoord.coordinates[0]
      }
      if (firstCoord.type === 'MultiLineString') {
        return firstCoord.coordinates[0]?.[0]
      }
      if (firstCoord.type === 'MultiPolygon') {
        return firstCoord.coordinates[0]?.[0]?.[0]
      }
      return null
    })()

    if (coordSample && (Math.abs(coordSample[0]) > 180 || Math.abs(coordSample[1]) > 90)) {
      return normalizeFeatures(collection, defaultCrs)
    }

    return collection
  }

  if (ext === '.csv') {
    const buffer = await fs.readFile(inputPath)
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    let raw = ''
    try {
      raw = utf8Decoder.decode(buffer)
    } catch {
      raw = new TextDecoder('big5').decode(buffer)
    }
    return parseCsv(raw, defaultCrs)
  }

  if (ext === '.shp') {
    const prjPath = inputPath.replace(/\.shp$/i, '.prj')
    const prj = (await fileExists(prjPath))
      ? await fs.readFile(prjPath, 'utf-8')
      : null
    let sourceCrs = detectCrsFromPrj(prj, defaultCrs)

    const source = await shapefile.open(inputPath)
    const features: Feature[] = []
    let result = await source.read()
    while (!result.done) {
      features.push(result.value as Feature)
      result = await source.read()
    }

    const collection = featureCollection(features)
    if (!prj && isLikelyLngLat(sampleCoordFromCollection(collection))) {
      sourceCrs = EPSG_4326
    }
    return normalizeFeatures(collection, sourceCrs)
  }

  throw new Error(`Unsupported input format: ${ext}`)
}

export const filterToBoundary = (
  collection: FeatureCollection,
  boundary: Feature<Polygon | MultiPolygon>,
): FeatureCollection => {
  const filtered = collection.features.filter((feature) => {
    if (!feature.geometry) {
      return false
    }
    return booleanIntersects(boundary, feature as Feature<Geometry, GeoJsonProperties>)
  })

  return featureCollection(filtered)
}

const pickRelevantProperties = (properties: GeoJsonProperties | null) => {
  if (!properties) {
    return null
  }
  const entries = Object.entries(properties)
  const filtered = entries.filter(([key]) =>
    /id|color|curb|mark|type|class|date|time|update|name|source|reliab|prov/i.test(
      key,
    ),
  )
  return Object.fromEntries(filtered)
}

export const reduceProperties = (
  collection: FeatureCollection,
): FeatureCollection => {
  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      properties: pickRelevantProperties(feature.properties ?? null) ?? feature.properties,
    })),
  }
}

export const loadBoundary = async (config: ResolvedConfig) => {
  const boundaryFile = getBoundaryFileName(config.districtId)
  const boundaryPath = path.resolve(config.outputs.generatedDir, boundaryFile)
  const raw = await fs.readFile(boundaryPath, 'utf-8')
  const geojson = JSON.parse(raw) as FeatureCollection
  const feature = geojson.features[0] as Feature<Polygon | MultiPolygon>
  if (!feature) {
    throw new Error('Boundary not found. Run ingestDistrictBounds first.')
  }
  return feature
}

export const writeGeoJson = async (
  config: ResolvedConfig,
  fileName: string,
  data: FeatureCollection,
) => {
  await ensureDirs(config)
  const output = JSON.stringify(data)
  await fs.writeFile(path.resolve(config.outputs.generatedDir, fileName), output, 'utf-8')
}

export const writeJson = async (
  config: ResolvedConfig,
  fileName: string,
  data: unknown,
) => {
  await ensureDirs(config)
  const output = JSON.stringify(data, null, 2)
  await fs.writeFile(path.resolve(config.outputs.generatedDir, fileName), output, 'utf-8')
}

const readCount = async (filePath: string) => {
  if (!(await fileExists(filePath))) {
    return 0
  }
  const raw = await fs.readFile(filePath, 'utf-8')
  const geojson = JSON.parse(raw) as FeatureCollection
  return geojson.features.length
}

const readCollection = async (filePath: string) => {
  if (!(await fileExists(filePath))) {
    return null
  }
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as FeatureCollection
}

const extractRiskTags = (properties: GeoJsonProperties | null): string[] => {
  if (!properties) {
    return []
  }
  const raw =
    properties.riskTags ?? properties.risk_tags ?? properties.riskTag ?? properties.risk_tag

  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry)).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,;|]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

const countRiskTags = (collection: FeatureCollection | null) => {
  if (!collection) {
    return null
  }
  const counts: Record<string, number> = {}
  collection.features.forEach((feature) => {
    const tags = extractRiskTags(feature.properties ?? null)
    tags.forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1
    })
  })
  return counts
}

const readProvenanceFetchedAt = async (config: ResolvedConfig) => {
  const candidates = [
    path.resolve(config.outputs.generatedDir, 'provenance.json'),
    path.resolve(
      process.cwd(),
      'data',
      'sources',
      config.districtId,
      'provenance.json',
    ),
  ]
  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) {
      continue
    }
    try {
      const raw = await fs.readFile(candidate, 'utf-8')
      const parsed = JSON.parse(raw) as { fetchedAt?: string }
      if (typeof parsed.fetchedAt === 'string') {
        return parsed.fetchedAt
      }
    } catch {
      continue
    }
  }
  return null
}

const buildQualityMetrics = (
  redYellow: FeatureCollection | null,
  signOverridesCollection: FeatureCollection | null,
  matchToleranceMeters: number,
) => {
  if (!redYellow || redYellow.features.length === 0) {
    return {
      segmentsCount: 0,
      curbMarkingKnownRate: 0,
      restrictionTriggeredRate: 0,
    }
  }

  const segments = (redYellow as FeatureCollection<LineString | MultiLineString>).features
    .flatMap((feature, index) => buildSegmentsFromFeature(feature, index, null))

  const segmentsWithOverrides = signOverridesCollection
    ? applySignOverrides(segments, signOverridesCollection, {
        matchToleranceMeters,
      })
    : segments

  const segmentsCount = segmentsWithOverrides.length
  if (segmentsCount === 0) {
    return {
      segmentsCount: 0,
      curbMarkingKnownRate: 0,
      restrictionTriggeredRate: 0,
    }
  }

  const knownCount = segmentsWithOverrides.filter(
    (segment) => segment.curbMarking !== 'UNKNOWN',
  ).length
  const triggeredCount = segmentsWithOverrides.filter((segment) => {
    const evaluated = evaluateSegment(segment, METRICS_SAMPLE_HHMM)
    return evaluated.allowedNow !== 'PARK'
  }).length

  return {
    segmentsCount,
    curbMarkingKnownRate: knownCount / segmentsCount,
    restrictionTriggeredRate: triggeredCount / segmentsCount,
  }
}

export const buildDatasetMeta = async (config: ResolvedConfig) => {
  const districtName =
    config.districtName ?? config.districtId ?? path.basename(config.outputs.generatedDir)
  const fileHashes = await hashFiles(config.outputs.generatedDir, PACK_FILE_LIST)
  const boundaryPath = path.resolve(
    config.outputs.generatedDir,
    getBoundaryFileName(config.districtId),
  )
  const paths = {
    redYellow: path.resolve(config.outputs.generatedDir, 'red_yellow.geojson'),
    busStops: path.resolve(config.outputs.generatedDir, 'bus_stops.geojson'),
    hydrants: path.resolve(config.outputs.generatedDir, 'hydrants.geojson'),
    intersections: path.resolve(
      config.outputs.generatedDir,
      'intersections.geojson',
    ),
    crosswalks: path.resolve(config.outputs.generatedDir, 'crosswalks.geojson'),
    signOverrides: path.resolve(
      config.outputs.generatedDir,
      'sign_overrides.geojson',
    ),
    overridesApplied: path.resolve(
      config.outputs.generatedDir,
      'overrides_applied.geojson',
    ),
    inferredCandidates: path.resolve(
      config.outputs.generatedDir,
      'candidates_inferred.geojson',
    ),
  }

  const [
    segments,
    busStops,
    hydrants,
    intersections,
    crosswalks,
    signOverrides,
    overridesApplied,
    inferredCandidates,
  ] = await Promise.all([
    readCount(paths.redYellow),
    readCount(paths.busStops),
    readCount(paths.hydrants),
    readCount(paths.intersections),
    readCount(paths.crosswalks),
    readCount(paths.signOverrides),
    readCount(paths.overridesApplied),
    readCount(paths.inferredCandidates),
  ])

  const redYellowCollection = await readCollection(paths.redYellow)
  const intersectionCollection = await readCollection(paths.intersections)
  const intersectionsBBox = intersectionCollection
    ? bboxFromCollection(intersectionCollection)
    : null
  const crosswalkCollection = await readCollection(paths.crosswalks)
  const crosswalksBBox = crosswalkCollection
    ? bboxFromCollection(crosswalkCollection)
    : null
  const signOverrideCollection = await readCollection(paths.signOverrides)
  const signOverridesBBox = signOverrideCollection
    ? bboxFromCollection(signOverrideCollection)
    : null
  const inferredCollection = await readCollection(paths.inferredCandidates)
  const inferredCandidatesBBox = inferredCollection
    ? bboxFromCollection(inferredCollection)
    : null
  const boundaryCollection = await readCollection(boundaryPath)
  const boundaryBBox = boundaryCollection
    ? bboxFromCollection(boundaryCollection)
    : null
  const boundaryCenter = centerFromBBox(boundaryBBox)
  const inferredRiskCounts = countRiskTags(inferredCollection)
  const provenanceFetchedAt = await readProvenanceFetchedAt(config)
  const qualityMetrics = buildQualityMetrics(
    redYellowCollection,
    signOverrideCollection,
    config.signOverrides.matchToleranceMeters,
  )

  const intersectionsReport = await (async () => {
    const reportPath = path.resolve(
      config.outputs.generatedDir,
      'intersections_report.json',
    )
    if (!(await fileExists(reportPath))) {
      return null
    }
    const raw = await fs.readFile(reportPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return parsed
  })()

  const signOverrideSource = config.inputs.sign_overrides
  const signOverrideFile = signOverrideSource
    ? config.sourceFiles.find((file) => file.path === signOverrideSource)
    : null
  const signOverridesUpdatedAt = signOverrideFile
    ? new Date(signOverrideFile.mtimeMs).toISOString()
    : null
  const signOverridesFreshnessDays = signOverrideFile
    ? daysSince(signOverrideFile.mtimeMs)
    : null

  return {
    schemaVersion: 1,
    metricsSchemaVersion: METRICS_SCHEMA_VERSION,
    districtId: config.districtId,
    districtName,
    generatedAt: new Date().toISOString(),
    configPath: config.configPath,
    configHash: config.configHash,
    datasetHash: config.datasetHash,
    segmentsCount: qualityMetrics.segmentsCount,
    overridesAppliedCount: overridesApplied,
    signOverridesCount: signOverrides,
    curbMarkingKnownRate: qualityMetrics.curbMarkingKnownRate,
    restrictionTriggeredRate: qualityMetrics.restrictionTriggeredRate,
    provenanceFetchedAt,
    signOverrideMatchToleranceMeters: config.signOverrides.matchToleranceMeters,
    sourceFiles: config.sourceFiles,
    counts: {
      segments,
      busStops,
      hydrants,
      intersections,
      crosswalks,
      signOverrides,
      overridesApplied,
      inferredCandidates,
      zones: busStops + hydrants + intersections + crosswalks,
    },
    intersectionsBBox,
    crosswalksBBox,
    signOverridesBBox,
    inferredCandidatesBBox,
    boundaryBBox,
    boundaryCenter,
    inferredRiskCounts,
    signOverridesUpdatedAt,
    signOverridesFreshnessDays,
    intersectionsReport: intersectionsReport
      ? {
          counts: intersectionsReport.counts,
          angleSpreadHistogram: intersectionsReport.angleSpreadHistogram,
          removed: intersectionsReport.removed,
        }
      : null,
    files: fileHashes.files,
    totalBytes: fileHashes.totalBytes,
  }
}

export const copyGeneratedToPublic = async (config: ResolvedConfig) => {
  await ensureDirs(config)
  await fs.cp(config.outputs.generatedDir, config.outputs.publicDir, {
    recursive: true,
    force: true,
  })
}
