import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePackageReleaseArgs } from './packageReleaseArgs'
import { writeReleaseArchive } from './packageReleaseArchive'
import { collectReleaseFiles } from './packageReleaseCollection'
import {
  buildReleaseTimestampId,
  getGitShortSha,
  readReleaseJson,
} from './packageReleaseUtils'
import type { RegistryEntry } from './packageReleaseTypes'

export { collectReleaseFiles } from './packageReleaseCollection'

export interface PackageReleaseResult {
  releaseId: string
  zipPath: string
  manifestPath: string
  baseDir: string
  districtIds: string[]
  fileCount: number
  totalBytes: number
}

const buildScopedRegistryContents = async (
  registryPath: string,
  districtIds: string[],
) => {
  if (districtIds.length === 0) {
    return null
  }

  const registry = await readReleaseJson<{ districts?: RegistryEntry[] } & Record<string, unknown>>(
    registryPath,
  )
  const districtSet = new Set(districtIds)
  const districts = registry.districts ?? []
  const scopedDistricts = districts.filter((district) => districtSet.has(district.districtId))
  const foundDistricts = new Set(scopedDistricts.map((district) => district.districtId))
  const missingDistricts = districtIds.filter((districtId) => !foundDistricts.has(districtId))

  if (missingDistricts.length > 0) {
    throw new Error(`Release package district not found in registry: ${missingDistricts.join(', ')}`)
  }

  return Buffer.from(
    `${JSON.stringify({ ...registry, districts: scopedDistricts }, null, 2)}\n`,
    'utf-8',
  )
}

export const packageRelease = async (params: {
  outDir: string
  includeGlob: string
  registryPath: string
  districtIds?: string[] | null
}): Promise<PackageReleaseResult> => {
  const registryPath = path.resolve(params.registryPath)
  const districtIds = params.districtIds ?? []
  const releaseId = `${buildReleaseTimestampId()}_${getGitShortSha()}`
  const { baseDir, files } = await collectReleaseFiles({
    registryPath,
    includeGlob: params.includeGlob,
    districtIds,
  })
  const registryContents = await buildScopedRegistryContents(registryPath, districtIds)
  const fileContents = registryContents ? new Map([[registryPath, registryContents]]) : undefined
  const { zipPath, manifestPath, releaseManifest } = await writeReleaseArchive({
    outDir: params.outDir,
    baseDir,
    files,
    releaseId,
    fileContents,
  })
  const totalBytes = releaseManifest.files.reduce((sum, file) => sum + file.bytes, 0)

  return {
    releaseId,
    zipPath,
    manifestPath,
    baseDir,
    districtIds,
    fileCount: releaseManifest.files.length,
    totalBytes,
  }
}

export const renderPackageReleaseResult = (result: PackageReleaseResult) =>
  [
    '# Release Package: PASS',
    '',
    `- Release ID: ${result.releaseId}`,
    `- Zip: ${result.zipPath}`,
    `- Manifest: ${result.manifestPath}`,
    `- Base dir: ${result.baseDir}`,
    `- Districts: ${result.districtIds.length > 0 ? result.districtIds.join(', ') : 'all'}`,
    `- Files: ${result.fileCount}`,
    `- Total bytes: ${result.totalBytes}`,
  ].join('\n')

const run = async () => {
  const args = parsePackageReleaseArgs(process.argv)
  const outDir = args.outDir ?? 'dist/releases'
  const includeGlob =
    args.include ??
    (args.districtIds.length === 1
      ? `public/data/generated/${args.districtIds[0]}/**`
      : 'public/data/generated/**')
  const registryPath =
    args.registry ?? 'public/data/generated/registry.json'

  const result = await packageRelease({
    outDir,
    includeGlob,
    registryPath,
    districtIds: args.districtIds,
  })
  console.log(renderPackageReleaseResult(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
