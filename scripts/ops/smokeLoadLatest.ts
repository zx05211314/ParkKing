import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface CliArgs {
  expectedCsv: string | null
  datasetRoot: string | null
  latestName: string | null
}

export interface SmokeLoadLatestOptions {
  datasetRoot?: string
  expectedDistricts?: string[]
  latestName?: string
}

const parseArgs = (argv: string[]): CliArgs => {
  const args = [...argv]
  const expectedIndex = args.findIndex((arg) => arg === '--expected')
  const rootIndex = args.findIndex((arg) => arg === '--datasetRoot')
  const latestNameIndex = args.findIndex((arg) => arg === '--latestName')
  return {
    expectedCsv: expectedIndex >= 0 ? args[expectedIndex + 1] ?? null : null,
    datasetRoot: rootIndex >= 0 ? args[rootIndex + 1] ?? null : null,
    latestName: latestNameIndex >= 0 ? args[latestNameIndex + 1] ?? null : null,
  }
}

const resolveLatestName = (value?: string | null) => {
  const normalized = value?.trim()
  if (normalized && normalized.length > 0) {
    return normalized
  }
  const fromEnv = process.env.PARKKING_LATEST_NAME?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'LATEST'
}

const latestPointerFileName = (latestName: string) => {
  return /\.json$/i.test(latestName) ? latestName : `${latestName}.json`
}

const parseExpectedDistricts = (value: string | null) => {
  if (!value) {
    return []
  }
  const seen = new Set<string>()
  const expected: string[] = []
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      if (seen.has(entry)) {
        return
      }
      seen.add(entry)
      expected.push(entry)
    })
  return expected
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const directoryExists = async (dirPath: string) => {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

const resolveDatasetRoot = (datasetRoot?: string) => {
  const root = datasetRoot ?? process.env.DATASET_DIR ?? 'public/data/generated'
  return path.resolve(root)
}

const ensureBoundaryFields = (meta: Record<string, unknown>, districtId: string) => {
  if (meta.districtId && meta.districtId !== districtId) {
    throw new Error(`dataset_meta districtId mismatch for ${districtId}`)
  }
  if (!meta.boundaryCenter || !meta.boundaryBBox) {
    throw new Error(`boundaryCenter/boundaryBBox missing for ${districtId}`)
  }
}

const collectExpectedDistrictErrors = async (params: {
  baseDir: string
  expectedDistricts: string[]
  registryDistrictIds: Set<string>
}) => {
  const errors: string[] = []

  for (const districtId of params.expectedDistricts) {
    const districtDir = path.resolve(params.baseDir, districtId)
    const metaPath = path.resolve(districtDir, 'dataset_meta.json')

    if (!params.registryDistrictIds.has(districtId)) {
      errors.push(`[${districtId}] registry missing in registry.json`)
    }

    const hasFolder = await directoryExists(districtDir)
    if (!hasFolder) {
      errors.push(`[${districtId}] folder missing at ${districtDir}`)
      continue
    }

    if (!(await fileExists(metaPath))) {
      errors.push(`[${districtId}] dataset_meta.json missing at ${metaPath}`)
      continue
    }

    try {
      const meta = await readJson<Record<string, unknown>>(metaPath)
      if (meta.districtId && meta.districtId !== districtId) {
        errors.push(
          `[${districtId}] dataset_meta.json districtId mismatch: ${String(meta.districtId)}`,
        )
      }
    } catch {
      errors.push(`[${districtId}] dataset_meta.json unreadable at ${metaPath}`)
    }
  }

  return errors
}

export const runSmokeLoadLatest = async (options: SmokeLoadLatestOptions = {}) => {
  const baseDir = resolveDatasetRoot(options.datasetRoot)
  const latestName = resolveLatestName(options.latestName)
  const pointerFileName = latestPointerFileName(latestName)
  const expectedDistricts = (options.expectedDistricts ?? []).filter(
    (districtId) => districtId.trim().length > 0,
  )

  const registryPath = path.resolve(baseDir, 'registry.json')
  const registry = await readJson<{ districts?: Array<{ districtId?: string }> }>(
    registryPath,
  )

  const districts = registry.districts ?? []
  if (expectedDistricts.length === 0 && districts.length < 2) {
    throw new Error(`Expected >= 2 districts in registry, got ${districts.length}`)
  }

  const registryDistrictIds = new Set<string>(
    districts
      .map((entry) => entry.districtId?.trim())
      .filter((entry): entry is string => Boolean(entry)),
  )

  if (expectedDistricts.length > 0) {
    const expectedErrors = await collectExpectedDistrictErrors({
      baseDir,
      expectedDistricts,
      registryDistrictIds,
    })
    if (expectedErrors.length > 0) {
      throw new Error(`Expected district checks failed:\n${expectedErrors.join('\n')}`)
    }
  }

  for (const entry of districts) {
    const districtId = entry.districtId
    if (!districtId) {
      throw new Error('Registry entry missing districtId')
    }
    const districtDir = path.resolve(baseDir, districtId)
    if (!(await directoryExists(districtDir))) {
      throw new Error(`Registry district folder missing for ${districtId}: ${districtDir}`)
    }

    const metaPath = path.resolve(districtDir, 'dataset_meta.json')
    if (!(await fileExists(metaPath))) {
      throw new Error(`Registry district dataset_meta missing for ${districtId}: ${metaPath}`)
    }
    const meta = await readJson<Record<string, unknown>>(metaPath)
    ensureBoundaryFields(meta, districtId)

    const latestPath = path.resolve(districtDir, pointerFileName)
    const latest = await readJson<{ manifestPath?: string }>(latestPath)
    if (!latest.manifestPath) {
      throw new Error(`${pointerFileName} missing manifestPath for ${districtId}`)
    }
    const manifestPath = path.resolve(baseDir, latest.manifestPath)
    const manifest = await readJson<Record<string, unknown>>(manifestPath)
    if (manifest.districtId && manifest.districtId !== districtId) {
      throw new Error(`Manifest districtId mismatch for ${districtId}`)
    }
  }

  console.log(`Smoke load ok: ${districts.length} districts`)
}

const run = async () => {
  const args = parseArgs(process.argv)
  await runSmokeLoadLatest({
    datasetRoot: args.datasetRoot ?? undefined,
    expectedDistricts: parseExpectedDistricts(args.expectedCsv),
    latestName: args.latestName ?? undefined,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
