import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import type { ReleaseManifestEntry, RegistryEntry } from './packageReleaseTypes'
import { sha256Buffer } from './packageReleaseUtils'

export interface ReleaseManifest {
  releaseId: string
  baseDir?: string
  files: ReleaseManifestEntry[]
}

export interface ValidateReleasePackageArgs {
  outDir?: string
  zipPath?: string
  manifestPath?: string
  districtIds: string[]
  outPath?: string
  jsonOutPath?: string
}

export interface ReleasePackagePaths {
  releaseId: string
  zipPath: string
  manifestPath: string
}

export interface ValidateReleasePackageResult extends ReleasePackagePaths {
  pass: boolean
  expectedDistrictIds: string[]
  registryDistrictIds: string[]
  fileCount: number
  totalBytes: number
  errors: string[]
}

const DEFAULT_RELEASE_OUT_DIR = 'dist/releases'
const RELEASE_ZIP_RE = /^park-king-data_(.+)\.zip$/
const RELEASE_MANIFEST_RE = /^release_manifest_(.+)\.json$/
const SHARED_RELEASE_ENTRY_PATHS = new Set([
  'registry.json',
  'ingest_all_report.json',
  '_ops/publish_gate_summary.json',
  '_ops/publish_gate_summary.md',
])

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const parseDistrictIds = (value: string | null) =>
  value === null
    ? []
    : value
        .split(',')
        .map((districtId) => districtId.trim())
        .filter(Boolean)

export const parseValidateReleasePackageArgs = (
  argv: string[],
): ValidateReleasePackageArgs => ({
  outDir:
    getArgValue(argv, '--out-dir', '--outDir') ?? DEFAULT_RELEASE_OUT_DIR,
  zipPath: getArgValue(argv, '--zip', '--zip-path', '--zipPath') ?? undefined,
  manifestPath:
    getArgValue(argv, '--manifest', '--manifest-path', '--manifestPath') ??
    undefined,
  districtIds: parseDistrictIds(getArgValue(argv, '--district', '--districts')),
  outPath: getArgValue(argv, '--out') ?? undefined,
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut') ?? undefined,
})

const readJsonFile = async <T>(filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const getReleaseIdFromPath = (filePath: string, pattern: RegExp) => {
  const match = path.basename(filePath).match(pattern)
  return match?.[1] ?? null
}

export const findLatestReleasePackage = async (
  outDir = DEFAULT_RELEASE_OUT_DIR,
): Promise<ReleasePackagePaths> => {
  const resolvedOutDir = path.resolve(outDir)
  const entries = await fs.readdir(resolvedOutDir, { withFileTypes: true })
  const manifestCandidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const releaseId = getReleaseIdFromPath(entry.name, RELEASE_MANIFEST_RE)
        if (!releaseId) {
          return null
        }
        const manifestPath = path.join(resolvedOutDir, entry.name)
        const zipPath = path.join(
          resolvedOutDir,
          `park-king-data_${releaseId}.zip`,
        )
        try {
          await fs.access(zipPath)
        } catch {
          return null
        }
        const stat = await fs.stat(manifestPath)
        return { releaseId, zipPath, manifestPath, mtimeMs: stat.mtimeMs }
      }),
  )
  const latest = manifestCandidates
    .filter((candidate): candidate is ReleasePackagePaths & { mtimeMs: number } =>
      candidate !== null,
    )
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.releaseId.localeCompare(a.releaseId))[0]

  if (!latest) {
    throw new Error(`No release zip/manifest pair found in ${resolvedOutDir}`)
  }

  return {
    releaseId: latest.releaseId,
    zipPath: latest.zipPath,
    manifestPath: latest.manifestPath,
  }
}

export const resolveReleasePackagePaths = async (
  args: ValidateReleasePackageArgs,
): Promise<ReleasePackagePaths> => {
  if (!args.zipPath && !args.manifestPath) {
    return await findLatestReleasePackage(args.outDir)
  }

  const zipPath = args.zipPath ? path.resolve(args.zipPath) : null
  const manifestPath = args.manifestPath ? path.resolve(args.manifestPath) : null
  const releaseId =
    (zipPath ? getReleaseIdFromPath(zipPath, RELEASE_ZIP_RE) : null) ??
    (manifestPath ? getReleaseIdFromPath(manifestPath, RELEASE_MANIFEST_RE) : null)

  if (!releaseId) {
    throw new Error('Could not infer release ID from release zip or manifest path')
  }

  const baseDir = path.dirname(zipPath ?? manifestPath ?? process.cwd())
  return {
    releaseId,
    zipPath: zipPath ?? path.join(baseDir, `park-king-data_${releaseId}.zip`),
    manifestPath:
      manifestPath ?? path.join(baseDir, `release_manifest_${releaseId}.json`),
  }
}

const sortedUnique = (values: string[]) => [...new Set(values)].sort()

const sameStringSet = (a: string[], b: string[]) => {
  const left = sortedUnique(a)
  const right = sortedUnique(b)
  return left.length === right.length && left.every((value, index) => value === right[index])
}

const isAllowedDistrictScopedEntry = (
  entryPath: string,
  districtIds: string[],
) =>
  SHARED_RELEASE_ENTRY_PATHS.has(entryPath) ||
  districtIds.some(
    (districtId) =>
      entryPath === districtId ||
      entryPath.startsWith(`${districtId}/`) ||
      entryPath.startsWith(`_ops/manifests/${districtId}/`),
  )

const parseRegistryDistrictIds = (registryContents: string) => {
  const registry = JSON.parse(registryContents) as {
    districts?: RegistryEntry[]
  }
  return (registry.districts ?? [])
    .map((district) => district.districtId)
    .filter((districtId): districtId is string => typeof districtId === 'string')
}

export const validateReleasePackage = async (
  args: ValidateReleasePackageArgs,
): Promise<ValidateReleasePackageResult> => {
  const paths = await resolveReleasePackagePaths(args)
  const manifest = await readJsonFile<ReleaseManifest>(paths.manifestPath)
  const zip = new AdmZip(paths.zipPath)
  const zipEntries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.entryName)
    .sort()
  const zipEntrySet = new Set(zipEntries)
  const manifestEntries = [...(manifest.files ?? [])].sort((a, b) =>
    a.path.localeCompare(b.path),
  )
  const manifestEntrySet = new Set(manifestEntries.map((entry) => entry.path))
  const errors: string[] = []

  if (manifest.releaseId !== paths.releaseId) {
    errors.push(
      `manifest releaseId ${manifest.releaseId} does not match package releaseId ${paths.releaseId}`,
    )
  }

  for (const entryName of zipEntries) {
    if (!manifestEntrySet.has(entryName)) {
      errors.push(`zip contains file not listed in manifest: ${entryName}`)
    }
  }

  for (const manifestEntry of manifestEntries) {
    if (!zipEntrySet.has(manifestEntry.path)) {
      errors.push(`manifest file missing from zip: ${manifestEntry.path}`)
      continue
    }
    const buffer = zip.getEntry(manifestEntry.path)?.getData()
    if (!buffer) {
      errors.push(`zip entry could not be read: ${manifestEntry.path}`)
      continue
    }
    if (buffer.length !== manifestEntry.bytes) {
      errors.push(
        `zip entry byte mismatch for ${manifestEntry.path}: manifest ${manifestEntry.bytes}, zip ${buffer.length}`,
      )
    }
    const sha256 = sha256Buffer(buffer)
    if (sha256 !== manifestEntry.sha256) {
      errors.push(
        `zip entry sha256 mismatch for ${manifestEntry.path}: manifest ${manifestEntry.sha256}, zip ${sha256}`,
      )
    }
  }

  const registryEntry = zip.getEntry('registry.json')
  const registryDistrictIds = registryEntry
    ? parseRegistryDistrictIds(registryEntry.getData().toString('utf-8'))
    : []
  if (!registryEntry) {
    errors.push('zip is missing registry.json')
  }

  if (args.districtIds.length > 0) {
    if (!sameStringSet(registryDistrictIds, args.districtIds)) {
      errors.push(
        `registry districts ${registryDistrictIds.join(', ') || 'none'} do not match expected ${args.districtIds.join(', ')}`,
      )
    }
    for (const entryName of zipEntries) {
      if (!isAllowedDistrictScopedEntry(entryName, args.districtIds)) {
        errors.push(
          `district-scoped release contains unexpected file: ${entryName}`,
        )
      }
    }
  }

  return {
    ...paths,
    pass: errors.length === 0,
    expectedDistrictIds: args.districtIds,
    registryDistrictIds,
    fileCount: manifestEntries.length,
    totalBytes: manifestEntries.reduce((sum, entry) => sum + entry.bytes, 0),
    errors,
  }
}

export const renderValidateReleasePackageResult = (
  result: ValidateReleasePackageResult,
) =>
  [
    `# Validate Release Package: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Release ID: ${result.releaseId}`,
    `- Zip: ${result.zipPath}`,
    `- Manifest: ${result.manifestPath}`,
    `- Expected districts: ${
      result.expectedDistrictIds.length > 0
        ? result.expectedDistrictIds.join(', ')
        : 'not enforced'
    }`,
    `- Registry districts: ${
      result.registryDistrictIds.length > 0
        ? result.registryDistrictIds.join(', ')
        : 'none'
    }`,
    `- Files: ${result.fileCount}`,
    `- Total bytes: ${result.totalBytes}`,
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
  ].join('\n')

export const writeValidateReleasePackageOutputs = async (
  result: ValidateReleasePackageResult,
  args: Pick<ValidateReleasePackageArgs, 'outPath' | 'jsonOutPath'>,
) => {
  if (args.outPath) {
    const resolved = path.resolve(args.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(
      resolved,
      `${renderValidateReleasePackageResult(result)}\n`,
      'utf-8',
    )
  }
  if (args.jsonOutPath) {
    const resolved = path.resolve(args.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

const run = async () => {
  const args = parseValidateReleasePackageArgs(process.argv)
  const result = await validateReleasePackage(args)
  await writeValidateReleasePackageOutputs(result, args)
  console.log(renderValidateReleasePackageResult(result))
  if (!result.pass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
