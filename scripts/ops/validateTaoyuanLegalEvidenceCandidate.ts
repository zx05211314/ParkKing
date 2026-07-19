import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { booleanIntersects, feature } from '@turf/turf'
import type { Geometry, MultiPolygon, Polygon } from 'geojson'

const DEFAULT_BOUNDARY_CATALOG = 'public/data/coverage.json'
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

type LayerKind = 'PARKING_SPACES' | 'CURB_RULES'

interface CandidateFile {
  kind: LayerKind
  path: string
  sha256: string
  featureCount: number
}

interface CandidateManifest {
  schemaVersion: number
  regionId: string
  authority: string
  datasetName: string
  sourceUrl: string
  licenseUrl: string
  retrievedAt: string
  sourceUpdatedAt: string
  sourcePath: string
  sourceSha256: string
  crs: string
  legalAnswerEligible: boolean
  requiresHumanReview: boolean
  files: CandidateFile[]
}

interface LayerSummary {
  kind: LayerKind
  path: string
  expectedFeatureCount: number
  actualFeatureCount: number
  valid: boolean
  errors: string[]
}

export interface TaoyuanLegalEvidenceCandidateResult {
  schemaVersion: 1
  status: 'INVALID' | 'PARTIAL_CANDIDATE' | 'READY_FOR_HUMAN_REVIEW'
  gatePass: boolean
  requireComplete: boolean
  candidateValid: boolean
  readyForHumanReview: boolean
  legalAnswerEligible: false
  manifestPath: string
  boundaryCatalogPath: string
  authority: string | null
  datasetName: string | null
  layers: LayerSummary[]
  missingLayers: LayerKind[]
  errors: string[]
  blockers: string[]
  nextActions: string[]
}

const getObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

const isIsoDate = (value: unknown) => {
  const text = getText(value)
  return text !== null && !Number.isNaN(new Date(text).getTime())
}

const isHttpsUrl = (value: unknown) => {
  const text = getText(value)
  if (!text) {
    return false
  }
  try {
    return new URL(text).protocol === 'https:'
  } catch {
    return false
  }
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const parseManifest = (value: unknown) => {
  const root = getObject(value)
  const errors: string[] = []
  if (!root) {
    return { manifest: null, errors: ['Candidate manifest must be an object.'] }
  }

  if (root.schemaVersion !== 1) {
    errors.push('Manifest schemaVersion must be 1.')
  }
  if (root.regionId !== 'taoyuan') {
    errors.push('Manifest regionId must be taoyuan.')
  }
  if (!getText(root.authority)) {
    errors.push('Manifest authority is required.')
  }
  if (!getText(root.datasetName)) {
    errors.push('Manifest datasetName is required.')
  }
  if (!isHttpsUrl(root.sourceUrl)) {
    errors.push('Manifest sourceUrl must be an HTTPS URL.')
  }
  if (!isHttpsUrl(root.licenseUrl)) {
    errors.push('Manifest licenseUrl must be an HTTPS URL.')
  }
  if (!isIsoDate(root.retrievedAt)) {
    errors.push('Manifest retrievedAt must be an ISO date.')
  }
  if (!isIsoDate(root.sourceUpdatedAt)) {
    errors.push('Manifest sourceUpdatedAt must be an ISO date.')
  }
  const sourcePath = getText(root.sourcePath)
  if (!sourcePath || path.isAbsolute(sourcePath)) {
    errors.push('Manifest sourcePath must be a relative file path.')
  }
  if (
    typeof root.sourceSha256 !== 'string' ||
    !SHA256_PATTERN.test(root.sourceSha256)
  ) {
    errors.push('Manifest sourceSha256 must be a lowercase SHA-256 hash.')
  }
  if (root.crs !== 'EPSG:4326') {
    errors.push('Manifest crs must be EPSG:4326.')
  }
  if (root.legalAnswerEligible !== false) {
    errors.push('Manifest legalAnswerEligible must remain false.')
  }
  if (root.requiresHumanReview !== true) {
    errors.push('Manifest requiresHumanReview must be true.')
  }

  const rawFiles = Array.isArray(root.files) ? root.files : []
  if (!Array.isArray(root.files)) {
    errors.push('Manifest files must be an array.')
  } else if (root.files.length === 0) {
    errors.push('Manifest files must contain at least one candidate layer.')
  }
  const files: CandidateFile[] = []
  const kinds = new Set<LayerKind>()
  rawFiles.forEach((value, index) => {
    const file = getObject(value)
    const prefix = `Manifest file ${index + 1}`
    if (!file) {
      errors.push(`${prefix} must be an object.`)
      return
    }
    const kind =
      file.kind === 'PARKING_SPACES' || file.kind === 'CURB_RULES'
        ? file.kind
        : null
    if (!kind) {
      errors.push(`${prefix} has an invalid kind.`)
    } else if (kinds.has(kind)) {
      errors.push(`${prefix} duplicates layer kind ${kind}.`)
    } else {
      kinds.add(kind)
    }
    const filePath = getText(file.path)
    if (!filePath || path.isAbsolute(filePath)) {
      errors.push(`${prefix} path must be a relative file path.`)
    }
    if (typeof file.sha256 !== 'string' || !SHA256_PATTERN.test(file.sha256)) {
      errors.push(`${prefix} sha256 must be a lowercase SHA-256 hash.`)
    }
    if (!isNonNegativeInteger(file.featureCount) || file.featureCount === 0) {
      errors.push(`${prefix} featureCount must be a positive integer.`)
    }
    if (
      kind &&
      filePath &&
      !path.isAbsolute(filePath) &&
      typeof file.sha256 === 'string' &&
      SHA256_PATTERN.test(file.sha256) &&
      isNonNegativeInteger(file.featureCount) &&
      file.featureCount > 0
    ) {
      files.push({
        kind,
        path: filePath,
        sha256: file.sha256,
        featureCount: file.featureCount,
      })
    }
  })

  return {
    manifest: {
      schemaVersion: Number(root.schemaVersion),
      regionId: String(root.regionId ?? ''),
      authority: getText(root.authority) ?? '',
      datasetName: getText(root.datasetName) ?? '',
      sourceUrl: getText(root.sourceUrl) ?? '',
      licenseUrl: getText(root.licenseUrl) ?? '',
      retrievedAt: getText(root.retrievedAt) ?? '',
      sourceUpdatedAt: getText(root.sourceUpdatedAt) ?? '',
      sourcePath: sourcePath ?? '',
      sourceSha256: getText(root.sourceSha256) ?? '',
      crs: getText(root.crs) ?? '',
      legalAnswerEligible: root.legalAnswerEligible === true,
      requiresHumanReview: root.requiresHumanReview === true,
      files,
    } satisfies CandidateManifest,
    errors,
  }
}

const readTaoyuanBoundaries = async (catalogPath: string) => {
  const root = getObject(
    JSON.parse(await fs.readFile(catalogPath, 'utf-8')) as unknown,
  )
  const districts = Array.isArray(root?.districts) ? root.districts : []
  const boundaries = new Map<string, Polygon | MultiPolygon>()
  districts.forEach((value) => {
    const district = getObject(value)
    const geometry = getObject(district?.boundaryGeometry)
    if (
      district?.regionId === 'taoyuan' &&
      typeof district.districtId === 'string' &&
      (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon')
    ) {
      boundaries.set(
        district.districtId,
        geometry as unknown as Polygon | MultiPolygon,
      )
    }
  })
  if (boundaries.size === 0) {
    throw new Error('Boundary catalog contains no Taoyuan districts.')
  }
  return boundaries
}

const isPosition = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  Math.abs(value[0]) <= 180 &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]) &&
  Math.abs(value[1]) <= 90

const isLineCoordinates = (value: unknown) =>
  Array.isArray(value) && value.length >= 2 && value.every(isPosition)

const isRingCoordinates = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) {
    return false
  }
  const first = value[0]
  const last = value[value.length - 1]
  return first[0] === last[0] && first[1] === last[1]
}

const hasValidGeometryStructure = (geometry: Record<string, unknown>) => {
  const coordinates = geometry.coordinates
  if (geometry.type === 'Point') {
    return isPosition(coordinates)
  }
  if (geometry.type === 'MultiPoint') {
    return (
      Array.isArray(coordinates) &&
      coordinates.length > 0 &&
      coordinates.every(isPosition)
    )
  }
  if (geometry.type === 'LineString') {
    return isLineCoordinates(coordinates)
  }
  if (geometry.type === 'MultiLineString') {
    return (
      Array.isArray(coordinates) &&
      coordinates.length > 0 &&
      coordinates.every(isLineCoordinates)
    )
  }
  if (geometry.type === 'Polygon') {
    return (
      Array.isArray(coordinates) &&
      coordinates.length > 0 &&
      coordinates.every(isRingCoordinates)
    )
  }
  return (
    geometry.type === 'MultiPolygon' &&
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every(
      (polygon) =>
        Array.isArray(polygon) &&
        polygon.length > 0 &&
        polygon.every(isRingCoordinates),
    )
  )
}

const getGeometryPositions = (geometry: Record<string, unknown>) => {
  if (!hasValidGeometryStructure(geometry)) {
    return null
  }
  const positions: [number, number][] = []
  const visit = (value: unknown): boolean => {
    if (!Array.isArray(value) || value.length === 0) {
      return false
    }
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      const position: [number, number] = [value[0], value[1]]
      positions.push(position)
      return true
    }
    return value.every(visit)
  }
  return visit(geometry.coordinates) && positions.length > 0
    ? positions
    : null
}

const validateTimeWindows = (value: unknown) => {
  if (!Array.isArray(value)) {
    return false
  }
  return value.every((entry) => {
    const window = getObject(entry)
    return (
      Boolean(getText(window?.label)) &&
      typeof window?.startHHMM === 'string' &&
      TIME_PATTERN.test(window.startHHMM) &&
      typeof window.endHHMM === 'string' &&
      TIME_PATTERN.test(window.endHHMM)
    )
  })
}

const resolveContainedPath = (baseDir: string, relativeFilePath: string) => {
  const resolvedPath = path.resolve(baseDir, relativeFilePath)
  const relativePath = path.relative(baseDir, resolvedPath)
  return relativePath.startsWith('..') ||
    path.isAbsolute(relativePath) ||
    relativePath.length === 0
    ? null
    : resolvedPath
}

const validateLayer = async (params: {
  manifestDir: string
  manifest: CandidateManifest
  file: CandidateFile
  boundaries: Map<string, Polygon | MultiPolygon>
}): Promise<LayerSummary> => {
  const errors: string[] = []
  const resolvedPath = resolveContainedPath(
    params.manifestDir,
    params.file.path,
  )
  if (!resolvedPath) {
    return {
      kind: params.file.kind,
      path: path.resolve(params.manifestDir, params.file.path),
      expectedFeatureCount: params.file.featureCount,
      actualFeatureCount: 0,
      valid: false,
      errors: ['Candidate layer path must stay inside the manifest directory.'],
    }
  }

  let buffer: Buffer
  let root: Record<string, unknown> | null
  try {
    buffer = await fs.readFile(resolvedPath)
    root = getObject(JSON.parse(buffer.toString('utf-8')) as unknown)
  } catch (error) {
    return {
      kind: params.file.kind,
      path: resolvedPath,
      expectedFeatureCount: params.file.featureCount,
      actualFeatureCount: 0,
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }

  if (createHash('sha256').update(buffer).digest('hex') !== params.file.sha256) {
    errors.push('Layer SHA-256 does not match the manifest.')
  }
  const metadata = getObject(root?.metadata)
  const features = Array.isArray(root?.features) ? root.features : []
  if (root?.type !== 'FeatureCollection') {
    errors.push('Layer type must be FeatureCollection.')
  }
  if (metadata?.layerKind !== params.file.kind) {
    errors.push(`Layer metadata layerKind must be ${params.file.kind}.`)
  }
  if (metadata?.datasetName !== params.manifest.datasetName) {
    errors.push('Layer metadata datasetName must match the manifest.')
  }
  if (metadata?.crs !== 'EPSG:4326') {
    errors.push('Layer metadata crs must be EPSG:4326.')
  }
  if (metadata?.legalAnswerEligible !== false) {
    errors.push('Layer metadata legalAnswerEligible must remain false.')
  }
  if (metadata?.requiresHumanReview !== true) {
    errors.push('Layer metadata requiresHumanReview must be true.')
  }
  if (features.length !== params.file.featureCount) {
    errors.push('Layer feature count does not match the manifest.')
  }

  const sourceIds = new Set<string>()
  features.forEach((value, index) => {
    const prefix = `${params.file.kind} feature ${index + 1}`
    const candidate = getObject(value)
    const geometry = getObject(candidate?.geometry)
    const properties = getObject(candidate?.properties)
    if (candidate?.type !== 'Feature' || !geometry) {
      errors.push(`${prefix} is not a valid GeoJSON feature.`)
      return
    }
    const positions = getGeometryPositions(geometry)
    if (!positions) {
      errors.push(`${prefix} has invalid coordinates.`)
      return
    }
    const sourceId = getText(properties?.sourceId)
    if (!sourceId) {
      errors.push(`${prefix} sourceId is required.`)
    } else if (sourceIds.has(sourceId)) {
      errors.push(`${prefix} duplicates sourceId ${sourceId}.`)
    } else {
      sourceIds.add(sourceId)
    }
    const districtId = getText(properties?.districtId)
    const boundary = districtId ? params.boundaries.get(districtId) : null
    if (!districtId || !boundary) {
      errors.push(`${prefix} has an unknown Taoyuan districtId.`)
    } else {
      try {
        if (
          !booleanIntersects(
            feature(geometry as unknown as Geometry),
            feature(boundary),
          )
        ) {
          errors.push(`${prefix} does not intersect its declared district.`)
        }
      } catch {
        errors.push(`${prefix} geometry cannot be checked against its district.`)
      }
    }
    if (properties?.sourceDataset !== params.manifest.datasetName) {
      errors.push(`${prefix} sourceDataset must match the manifest.`)
    }
    if (properties?.legalAnswerEligible !== false) {
      errors.push(`${prefix} legalAnswerEligible must remain false.`)
    }
    if (properties?.requiresHumanReview !== true) {
      errors.push(`${prefix} requiresHumanReview must be true.`)
    }
    if (properties?.reviewStatus !== 'PENDING') {
      errors.push(`${prefix} reviewStatus must be PENDING at intake.`)
    }

    if (params.file.kind === 'PARKING_SPACES') {
      const supportedGeometry = [
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
        'Polygon',
        'MultiPolygon',
      ].includes(String(geometry.type))
      const pointGeometry =
        geometry.type === 'Point' || geometry.type === 'MultiPoint'
      const expectedPrecision = pointGeometry
        ? 'OFFICIAL_SPOT_POSITION'
        : 'EXACT_PARKING_SPACE'
      if (!supportedGeometry) {
        errors.push(`${prefix} has an unsupported parking-space geometry.`)
      }
      if (properties?.evidenceKind !== 'OFFICIAL_PARKING_SPACE') {
        errors.push(`${prefix} has an invalid evidenceKind.`)
      }
      if (properties?.geometryPrecision !== expectedPrecision) {
        errors.push(
          `${prefix} geometryPrecision must be ${expectedPrecision}.`,
        )
      }
      if (properties?.parkingStatus !== 'ACTIVE') {
        errors.push(`${prefix} parkingStatus must be ACTIVE.`)
      }
    } else {
      if (
        geometry.type !== 'LineString' &&
        geometry.type !== 'MultiLineString'
      ) {
        errors.push(`${prefix} curb-rule geometry must be a line.`)
      }
      if (properties?.evidenceKind !== 'OFFICIAL_CURB_RULE') {
        errors.push(`${prefix} has an invalid evidenceKind.`)
      }
      if (properties?.geometryPrecision !== 'EXACT_CURB_LINE') {
        errors.push(`${prefix} geometryPrecision must be EXACT_CURB_LINE.`)
      }
      if (
        properties?.curbRule !== 'RED_NO_STOP' &&
        properties?.curbRule !== 'YELLOW_TEMP_STOP' &&
        properties?.curbRule !== 'PARKING_ALLOWED'
      ) {
        errors.push(`${prefix} has an invalid curbRule.`)
      }
      if (!validateTimeWindows(properties?.timeWindows)) {
        errors.push(`${prefix} timeWindows must be a valid array.`)
      }
    }
  })

  return {
    kind: params.file.kind,
    path: resolvedPath,
    expectedFeatureCount: params.file.featureCount,
    actualFeatureCount: features.length,
    valid: errors.length === 0,
    errors,
  }
}

export const runTaoyuanLegalEvidenceCandidateValidation = async (options: {
  manifestPath: string
  boundaryCatalogPath?: string
  requireComplete?: boolean
  outPath?: string | null
  jsonOutPath?: string | null
}) => {
  const manifestPath = path.resolve(options.manifestPath)
  const boundaryCatalogPath = path.resolve(
    options.boundaryCatalogPath ?? DEFAULT_BOUNDARY_CATALOG,
  )
  const { manifest, errors: manifestErrors } = parseManifest(
    JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as unknown,
  )
  const errors = [...manifestErrors]
  let layers: LayerSummary[] = []
  if (manifest) {
    const manifestDir = path.dirname(manifestPath)
    const sourcePath = resolveContainedPath(manifestDir, manifest.sourcePath)
    if (!sourcePath) {
      errors.push('Source: sourcePath must stay inside the manifest directory.')
    } else {
      try {
        const sourceBuffer = await fs.readFile(sourcePath)
        const actualSourceSha256 = createHash('sha256')
          .update(sourceBuffer)
          .digest('hex')
        if (actualSourceSha256 !== manifest.sourceSha256) {
          errors.push('Source: SHA-256 does not match sourceSha256.')
        }
      } catch (error) {
        errors.push(
          `Source: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    try {
      const boundaries = await readTaoyuanBoundaries(boundaryCatalogPath)
      layers = await Promise.all(
        manifest.files.map((file) =>
          validateLayer({
            manifestDir,
            manifest,
            file,
            boundaries,
          }),
        ),
      )
      errors.push(
        ...layers.flatMap((layer) =>
          layer.errors.map((error) => `${layer.kind}: ${error}`),
        ),
      )
    } catch (error) {
      errors.push(
        `Boundary catalog: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const availableKinds = new Set(layers.map(({ kind }) => kind))
  const missingLayers = (
    ['PARKING_SPACES', 'CURB_RULES'] as LayerKind[]
  ).filter((kind) => !availableKinds.has(kind))
  const candidateValid = errors.length === 0
  const readyForHumanReview =
    candidateValid && missingLayers.length === 0 && layers.every(({ valid }) => valid)
  const requireComplete = Boolean(options.requireComplete)
  const gatePass =
    candidateValid && (!requireComplete || readyForHumanReview)
  const status = !candidateValid
    ? 'INVALID'
    : readyForHumanReview
      ? 'READY_FOR_HUMAN_REVIEW'
      : 'PARTIAL_CANDIDATE'
  const blockers = [
    ...missingLayers.map((kind) => `${kind} candidate layer is missing.`),
    'Candidate evidence requires a separate human-review and promotion gate.',
    'No candidate file may enable legal parking answers directly.',
  ]
  const result: TaoyuanLegalEvidenceCandidateResult = {
    schemaVersion: 1,
    status,
    gatePass,
    requireComplete,
    candidateValid,
    readyForHumanReview,
    legalAnswerEligible: false,
    manifestPath,
    boundaryCatalogPath,
    authority: manifest?.authority || null,
    datasetName: manifest?.datasetName || null,
    layers,
    missingLayers,
    errors,
    blockers,
    nextActions: !candidateValid
      ? ['Correct the manifest and layer validation errors, then rerun this gate.']
      : !readyForHumanReview
        ? [
            `Acquire and normalize the missing layers: ${missingLayers.join(', ')}.`,
            'Rerun this command with --require-complete.',
          ]
        : [
            'Build a district-stratified human-review package for the candidate features.',
            'Do not connect the candidate to configs/prod before reviewed answer cases pass.',
          ],
  }

  const markdown = renderTaoyuanLegalEvidenceCandidate(result)
  const writes: Promise<void>[] = []
  if (options.outPath) {
    const outPath = path.resolve(options.outPath)
    writes.push(
      fs
        .mkdir(path.dirname(outPath), { recursive: true })
        .then(() => fs.writeFile(outPath, `${markdown}\n`, 'utf-8')),
    )
  }
  if (options.jsonOutPath) {
    const jsonOutPath = path.resolve(options.jsonOutPath)
    writes.push(
      fs
        .mkdir(path.dirname(jsonOutPath), { recursive: true })
        .then(() =>
          fs.writeFile(
            jsonOutPath,
            `${JSON.stringify(result, null, 2)}\n`,
            'utf-8',
          ),
        ),
    )
  }
  await Promise.all(writes)
  return result
}

export const renderTaoyuanLegalEvidenceCandidate = (
  result: TaoyuanLegalEvidenceCandidateResult,
) =>
  [
    `# Taoyuan legal evidence candidate: ${result.status}`,
    '',
    `- Gate: ${result.gatePass ? 'PASS' : 'FAIL'}`,
    `- Complete candidate required: ${result.requireComplete ? 'yes' : 'no'}`,
    `- Candidate valid: ${result.candidateValid ? 'yes' : 'no'}`,
    `- Ready for human review: ${result.readyForHumanReview ? 'yes' : 'no'}`,
    `- Eligible for legal parking answers: ${result.legalAnswerEligible ? 'yes' : 'no'}`,
    `- Manifest: ${result.manifestPath}`,
    `- Authority: ${result.authority ?? '-'}`,
    `- Dataset: ${result.datasetName ?? '-'}`,
    '',
    '## Layers',
    '',
    ...(result.layers.length > 0
      ? result.layers.map(
          (layer) =>
            `- ${layer.kind}: ${layer.valid ? 'valid' : 'invalid'}; features=${layer.actualFeatureCount}/${layer.expectedFeatureCount}; ${layer.path}`,
        )
      : ['- none']),
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
    '',
    '## Blockers',
    '',
    ...result.blockers.map((blocker) => `- ${blocker}`),
    '',
    '## Next actions',
    '',
    ...result.nextActions.map((action) => `- ${action}`),
  ].join('\n')

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const run = async () => {
  const manifestPath = getArgValue(process.argv, '--manifest')
  if (!manifestPath) {
    throw new Error('--manifest is required.')
  }
  const result = await runTaoyuanLegalEvidenceCandidateValidation({
    manifestPath,
    boundaryCatalogPath:
      getArgValue(process.argv, '--boundary-catalog') ?? undefined,
    requireComplete: process.argv.includes('--require-complete'),
    outPath: getArgValue(process.argv, '--out'),
    jsonOutPath: getArgValue(process.argv, '--json-out'),
  })
  console.log(renderTaoyuanLegalEvidenceCandidate(result))
  if (!result.gatePass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
