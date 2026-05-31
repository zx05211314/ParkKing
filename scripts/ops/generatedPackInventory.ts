import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  listSmokePublicDistrictDirs,
  smokePublicDataDirectoryExists,
  smokePublicDataFileExists,
} from './smokePublicDataFiles'

const DEFAULT_ROOT = 'public/data/generated'
const CRITICAL_LAYER_FILES = [
  'red_yellow.geojson',
  'parking_spaces.geojson',
  'candidates_inferred.geojson',
  'sign_overrides.geojson',
] as const

export type GeneratedPackInventoryStatus =
  | 'published'
  | 'stale-unpublished'
  | 'missing-published-dir'

export interface GeneratedPackInventoryOptions {
  root?: string
  registryPath?: string | null
  summaryPath?: string
  strict?: boolean
  json?: boolean
}

export interface GeneratedPackRegistryEntry {
  districtId: string
  districtName?: string
  datasetHash?: string
  generatedAt?: string
  publishedAt?: string
}

export interface GeneratedPackInventoryEntry {
  districtId: string
  status: GeneratedPackInventoryStatus
  dirPath: string | null
  registryEntry: GeneratedPackRegistryEntry | null
  datasetHash: string | null
  generatedAt: string | null
  publishedAt: string | null
  counts: {
    segments: number | null
    parkingSpaces: number | null
    signOverrides: number | null
    inferredCandidates: number | null
  }
  files: Record<string, boolean>
  warnings: string[]
}

export interface GeneratedPackInventoryResult {
  root: string
  registryPath: string
  registryFound: boolean
  entries: GeneratedPackInventoryEntry[]
  warnings: string[]
  errors: string[]
  hasWarnings: boolean
  hasErrors: boolean
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parseGeneratedPackInventoryArgs = (
  argv: string[],
): GeneratedPackInventoryOptions => ({
  root: getArgValue(argv, '--root', '--base-dir', '--baseDir') ?? DEFAULT_ROOT,
  registryPath:
    getArgValue(argv, '--registry', '--registry-path', '--registryPath') ??
    undefined,
  summaryPath:
    getArgValue(argv, '--summary', '--summary-path', '--summaryPath') ?? undefined,
  strict: hasFlag(argv, '--strict'),
  json: hasFlag(argv, '--json'),
})

const readJsonFile = async (filePath: string) => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

const readRegistry = async (registryPath: string) => {
  if (!(await smokePublicDataFileExists(registryPath))) {
    return { found: false, entries: [] as GeneratedPackRegistryEntry[] }
  }

  const parsed = await readJsonFile(registryPath)
  const districts = parsed.districts
  if (!Array.isArray(districts)) {
    throw new Error(`registry.json missing districts array: ${registryPath}`)
  }

  const entries = districts.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`registry district at index ${index} is not an object`)
    }
    const candidate = entry as Record<string, unknown>
    if (
      typeof candidate.districtId !== 'string' ||
      candidate.districtId.trim() === ''
    ) {
      throw new Error(`registry district at index ${index} is missing districtId`)
    }
    return {
      districtId: candidate.districtId.trim(),
      districtName:
        typeof candidate.districtName === 'string'
          ? candidate.districtName
          : undefined,
      datasetHash:
        typeof candidate.datasetHash === 'string'
          ? candidate.datasetHash
          : undefined,
      generatedAt:
        typeof candidate.generatedAt === 'string' ? candidate.generatedAt : undefined,
      publishedAt:
        typeof candidate.publishedAt === 'string'
          ? candidate.publishedAt
          : undefined,
    }
  })

  return { found: true, entries }
}

const getCount = (
  meta: Record<string, unknown>,
  topLevelKey: string,
  countsKey: string,
) => {
  const topLevelValue = meta[topLevelKey]
  if (typeof topLevelValue === 'number') {
    return topLevelValue
  }
  const counts = meta.counts
  if (typeof counts === 'object' && counts !== null) {
    const countValue = (counts as Record<string, unknown>)[countsKey]
    if (typeof countValue === 'number') {
      return countValue
    }
  }
  return null
}

const readPackMeta = async (districtDir: string) => {
  const metaPath = path.resolve(districtDir, 'dataset_meta.json')
  if (!(await smokePublicDataFileExists(metaPath))) {
    return null
  }
  return readJsonFile(metaPath)
}

const buildEntry = async (params: {
  root: string
  districtId: string
  dirIds: Set<string>
  registryEntry: GeneratedPackRegistryEntry | null
  registryFound: boolean
}): Promise<GeneratedPackInventoryEntry> => {
  const { root, districtId, dirIds, registryEntry, registryFound } = params
  const dirPath = dirIds.has(districtId) ? path.resolve(root, districtId) : null
  const status: GeneratedPackInventoryStatus = registryEntry
    ? dirPath
      ? 'published'
      : 'missing-published-dir'
    : 'stale-unpublished'
  const warnings: string[] = []
  const files: Record<string, boolean> = {}
  let meta: Record<string, unknown> | null = null

  if (!registryEntry && registryFound) {
    warnings.push('directory is not listed in registry.json; runtime loading ignores it')
  }

  if (!dirPath) {
    warnings.push('registry lists this district, but the district directory is missing')
  } else {
    meta = await readPackMeta(dirPath)
    if (!meta) {
      warnings.push('dataset_meta.json is missing')
    }

    const latestPath = path.resolve(dirPath, 'LATEST.json')
    files['LATEST.json'] = await smokePublicDataFileExists(latestPath)
    if (registryEntry && !files['LATEST.json']) {
      warnings.push('LATEST.json is missing for a published district')
    }

    for (const fileName of CRITICAL_LAYER_FILES) {
      const exists = await smokePublicDataFileExists(path.resolve(dirPath, fileName))
      files[fileName] = exists
      if (!exists) {
        warnings.push(`${fileName} is missing`)
      }
    }
  }

  const metaDistrictId =
    typeof meta?.districtId === 'string' ? meta.districtId.trim() : null
  const datasetHash =
    typeof meta?.datasetHash === 'string'
      ? meta.datasetHash
      : registryEntry?.datasetHash ?? null
  const generatedAt =
    typeof meta?.generatedAt === 'string'
      ? meta.generatedAt
      : registryEntry?.generatedAt ?? null
  const publishedAt =
    typeof meta?.publishedAt === 'string'
      ? meta.publishedAt
      : registryEntry?.publishedAt ?? null

  if (metaDistrictId && metaDistrictId !== districtId) {
    warnings.push(`dataset_meta districtId ${metaDistrictId} does not match ${districtId}`)
  }
  if (
    registryEntry?.datasetHash &&
    typeof meta?.datasetHash === 'string' &&
    meta.datasetHash !== registryEntry.datasetHash
  ) {
    warnings.push('dataset_meta datasetHash does not match registry entry')
  }

  const parkingSpaces = getCount(meta ?? {}, 'parkingSpacesCount', 'parkingSpaces')
  const signOverrides = getCount(meta ?? {}, 'signOverridesCount', 'signOverrides')
  const inferredCandidates = getCount(
    meta ?? {},
    'inferredCandidatesCount',
    'inferredCandidates',
  )
  if (parkingSpaces !== null && parkingSpaces === 0) {
    warnings.push('parkingSpaces count is zero')
  }
  if (signOverrides !== null && signOverrides === 0) {
    warnings.push('signOverrides count is zero')
  }
  if (inferredCandidates !== null && inferredCandidates === 0) {
    warnings.push('inferredCandidates count is zero')
  }

  return {
    districtId,
    status,
    dirPath,
    registryEntry,
    datasetHash,
    generatedAt,
    publishedAt,
    counts: {
      segments: getCount(meta ?? {}, 'segmentsCount', 'segments'),
      parkingSpaces,
      signOverrides,
      inferredCandidates,
    },
    files,
    warnings,
  }
}

export const runGeneratedPackInventory = async (
  options: GeneratedPackInventoryOptions = {},
): Promise<GeneratedPackInventoryResult> => {
  const root = path.resolve(options.root ?? DEFAULT_ROOT)
  const registryPath = path.resolve(
    options.registryPath ?? path.join(root, 'registry.json'),
  )
  const errors: string[] = []
  const warnings: string[] = []

  if (!(await smokePublicDataDirectoryExists(root))) {
    return {
      root,
      registryPath,
      registryFound: false,
      entries: [],
      warnings,
      errors: [`Generated data root missing: ${root}`],
      hasWarnings: false,
      hasErrors: true,
    }
  }

  let registryFound = false
  let registryEntries: GeneratedPackRegistryEntry[] = []
  try {
    const registry = await readRegistry(registryPath)
    registryFound = registry.found
    registryEntries = registry.entries
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  if (!registryFound && errors.length === 0) {
    warnings.push(`registry.json missing at ${registryPath}`)
  }

  const dirIds = new Set(await listSmokePublicDistrictDirs(root))
  const registryByDistrict = new Map(
    registryEntries.map((entry) => [entry.districtId, entry]),
  )
  const districtIds = Array.from(
    new Set([...dirIds, ...registryByDistrict.keys()]),
  ).sort((a, b) => a.localeCompare(b))

  if (districtIds.length === 0) {
    warnings.push(`no district directories or registry entries found under ${root}`)
  }

  const entries = await Promise.all(
    districtIds.map((districtId) =>
      buildEntry({
        root,
        districtId,
        dirIds,
        registryEntry: registryByDistrict.get(districtId) ?? null,
        registryFound,
      }),
    ),
  )

  const entryWarnings = entries.flatMap((entry) =>
    entry.warnings.map((warning) => `[${entry.districtId}] ${warning}`),
  )
  const allWarnings = [...warnings, ...entryWarnings]

  return {
    root,
    registryPath,
    registryFound,
    entries,
    warnings: allWarnings,
    errors,
    hasWarnings: allWarnings.length > 0,
    hasErrors: errors.length > 0,
  }
}

const formatCount = (value: number | null) => (value === null ? '-' : String(value))

const formatFiles = (files: Record<string, boolean>) => {
  const missing = Object.entries(files)
    .filter(([, exists]) => !exists)
    .map(([fileName]) => fileName)
  if (missing.length === 0) {
    return 'ok'
  }
  return `missing ${missing.join(', ')}`
}

export const renderGeneratedPackInventory = (
  result: GeneratedPackInventoryResult,
) => {
  const stale = result.entries.filter((entry) => entry.status === 'stale-unpublished')
  const missingPublished = result.entries.filter(
    (entry) => entry.status === 'missing-published-dir',
  )
  const published = result.entries.filter((entry) => entry.status === 'published')
  const status = result.hasErrors ? 'FAIL' : result.hasWarnings ? 'WARN' : 'PASS'
  const lines = [
    `Generated pack inventory: ${status}`,
    `Root: ${result.root}`,
    `Registry: ${result.registryFound ? result.registryPath : '-'}`,
    `Published districts: ${published.length}`,
    `Directory districts: ${result.entries.filter((entry) => entry.dirPath).length}`,
    `Stale unpublished dirs: ${stale.map((entry) => entry.districtId).join(', ') || 'none'}`,
    `Missing published dirs: ${missingPublished.map((entry) => entry.districtId).join(', ') || 'none'}`,
  ]

  result.errors.forEach((error) => {
    lines.push(`ERROR: ${error}`)
  })

  result.entries.forEach((entry) => {
    lines.push(`- ${entry.status.toUpperCase()} ${entry.districtId}`)
    lines.push(`  Dir: ${entry.dirPath ?? '-'}`)
    lines.push(`  Dataset hash: ${entry.datasetHash ?? '-'}`)
    lines.push(`  Generated at: ${entry.generatedAt ?? '-'}`)
    lines.push(`  Published at: ${entry.publishedAt ?? '-'}`)
    lines.push(
      `  Counts: segments ${formatCount(entry.counts.segments)}, parkingSpaces ${formatCount(entry.counts.parkingSpaces)}, signOverrides ${formatCount(entry.counts.signOverrides)}, inferredCandidates ${formatCount(entry.counts.inferredCandidates)}`,
    )
    lines.push(`  Critical files: ${formatFiles(entry.files)}`)
    entry.warnings.forEach((warning) => {
      lines.push(`  WARN: ${warning}`)
    })
  })

  return lines.join('\n')
}

export const resolveGeneratedPackInventorySummaryPath = (
  options: Pick<GeneratedPackInventoryOptions, 'summaryPath'>,
  env: NodeJS.ProcessEnv = process.env,
) => (options.summaryPath ?? env.GITHUB_STEP_SUMMARY?.trim()) || undefined

const run = async () => {
  const options = parseGeneratedPackInventoryArgs(process.argv)
  const result = await runGeneratedPackInventory(options)
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : renderGeneratedPackInventory(result)
  console.log(output)

  const summaryPath = resolveGeneratedPackInventorySummaryPath(options)
  if (summaryPath) {
    await fs.appendFile(summaryPath, `${renderGeneratedPackInventory(result)}\n\n`)
  }

  if (result.hasErrors || (options.strict && result.hasWarnings)) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
