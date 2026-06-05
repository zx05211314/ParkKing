import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePackageReleaseArgs } from './packageReleaseArgs'
import { writeReleaseArchive } from './packageReleaseArchive'
import { collectReleaseFiles } from './packageReleaseCollection'
import {
  buildReleaseTimestampId,
  getGitShortSha,
  readReleaseJson,
  validateReleaseId,
} from './packageReleaseUtils'
import type {
  RegistryEntry,
  ReleaseManifestDistrict,
} from './packageReleaseTypes'
import {
  DEFAULT_REVIEWED_ANSWER_CASES_GLOB,
  discoverReviewedDistrictIds,
} from './reviewedDistrictDiscovery'

export { collectReleaseFiles } from './packageReleaseCollection'

export interface PackageReleaseResult {
  releaseId: string
  zipPath: string
  manifestPath: string
  baseDir: string
  districtIds: string[]
  releaseDistricts: ReleaseManifestDistrict[]
  fileCount: number
  totalBytes: number
}

const toReleaseManifestDistricts = (
  districts: RegistryEntry[],
): ReleaseManifestDistrict[] =>
  districts
    .map((district) => {
      const datasetHash = district.latest?.datasetHash
      const publishedAt = district.latest?.publishedAt
      if (!datasetHash || !publishedAt) {
        throw new Error(
          `Release package registry district ${district.districtId} is missing latest datasetHash/publishedAt`,
        )
      }
      return {
        districtId: district.districtId,
        datasetHash,
        publishedAt,
      }
    })
    .sort((left, right) => left.districtId.localeCompare(right.districtId))

const resolveReleaseRegistryScope = async (
  registryPath: string,
  districtIds: string[],
) => {
  const registry = await readReleaseJson<{ districts?: RegistryEntry[] } & Record<string, unknown>>(
    registryPath,
  )
  const districts = registry.districts ?? []
  if (districtIds.length === 0) {
    return {
      registryContents: null,
      releaseDistricts: toReleaseManifestDistricts(districts),
    }
  }

  const districtSet = new Set(districtIds)
  const scopedDistricts = districts.filter((district) => districtSet.has(district.districtId))
  const foundDistricts = new Set(scopedDistricts.map((district) => district.districtId))
  const missingDistricts = districtIds.filter((districtId) => !foundDistricts.has(districtId))

  if (missingDistricts.length > 0) {
    throw new Error(`Release package district not found in registry: ${missingDistricts.join(', ')}`)
  }

  return {
    registryContents: Buffer.from(
      `${JSON.stringify({ ...registry, districts: scopedDistricts }, null, 2)}\n`,
      'utf-8',
    ),
    releaseDistricts: toReleaseManifestDistricts(scopedDistricts),
  }
}

export const packageRelease = async (params: {
  outDir: string
  includeGlob: string
  registryPath: string
  districtIds?: string[] | null
  releaseId?: string | null
}): Promise<PackageReleaseResult> => {
  const registryPath = path.resolve(params.registryPath)
  const districtIds = params.districtIds ?? []
  const releaseId = params.releaseId?.trim()
    ? validateReleaseId(params.releaseId)
    : `${buildReleaseTimestampId()}_${getGitShortSha()}`
  const { baseDir, files } = await collectReleaseFiles({
    registryPath,
    includeGlob: params.includeGlob,
    districtIds,
  })
  const { registryContents, releaseDistricts } = await resolveReleaseRegistryScope(
    registryPath,
    districtIds,
  )
  const fileContents = registryContents
    ? new Map([[registryPath, registryContents]])
    : undefined
  const { zipPath, manifestPath, releaseManifest } = await writeReleaseArchive({
    outDir: params.outDir,
    baseDir,
    files,
    releaseId,
    districts: releaseDistricts,
    fileContents,
  })
  const totalBytes = releaseManifest.files.reduce((sum, file) => sum + file.bytes, 0)

  return {
    releaseId,
    zipPath,
    manifestPath,
    baseDir,
    districtIds,
    releaseDistricts: releaseManifest.districts,
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
    `- Dataset hashes: ${
      result.releaseDistricts
        .map((district) => `${district.districtId}:${district.datasetHash.slice(0, 12)}`)
        .join(', ') || '-'
    }`,
    `- Files: ${result.fileCount}`,
    `- Total bytes: ${result.totalBytes}`,
  ].join('\n')

export const resolvePackageReleaseDistrictIds = async (args: {
  districtIds: string[]
  reviewed?: boolean
  answerCasesGlob?: string | null
}) => {
  if (args.districtIds.length > 0) {
    return args.districtIds
  }
  if (!args.reviewed) {
    return []
  }
  return await discoverReviewedDistrictIds(
    args.answerCasesGlob?.trim() || DEFAULT_REVIEWED_ANSWER_CASES_GLOB,
  )
}

const run = async () => {
  const args = parsePackageReleaseArgs(process.argv)
  const districtIds = await resolvePackageReleaseDistrictIds(args)
  const outDir = args.outDir ?? 'dist/releases'
  const includeGlob =
    args.include ??
    (districtIds.length === 1
      ? `public/data/generated/${districtIds[0]}/**`
      : 'public/data/generated/**')
  const registryPath =
    args.registry ?? 'public/data/generated/registry.json'

  const result = await packageRelease({
    outDir,
    includeGlob,
    registryPath,
    districtIds,
    releaseId: args.releaseId ?? process.env.PARKKING_RELEASE_ID_INPUT,
  })
  console.log(renderPackageReleaseResult(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
