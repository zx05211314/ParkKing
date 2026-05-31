import * as path from 'node:path'
import type { RegistryEntry } from './packageReleaseTypes'
import { collectDistrictReleaseFiles } from './packageReleaseDistrictFiles'
import { collectIncludedReleaseFiles } from './packageReleaseIncludeFiles'
import { collectOptionalReleaseFiles } from './packageReleaseOptionalFiles'
import { readReleaseJson } from './packageReleaseUtils'

const isInsidePath = (parent: string, candidate: string) => {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const filterIncludedFilesByDistrict = (
  baseDir: string,
  files: string[],
  districtIds: string[],
) => {
  if (districtIds.length === 0) {
    return files
  }

  const allowedRoots = districtIds.flatMap((districtId) => [
    path.resolve(baseDir, districtId),
    path.resolve(baseDir, '_ops', 'manifests', districtId),
  ])

  return files.filter((filePath) =>
    allowedRoots.some((root) => isInsidePath(root, filePath)),
  )
}

export const collectReleaseFiles = async (params: {
  registryPath: string
  includeGlob: string
  districtIds?: string[] | null
}) => {
  const registryPath = path.resolve(params.registryPath)
  const baseDir = path.dirname(registryPath)
  const registry = await readReleaseJson<{ districts: RegistryEntry[] }>(registryPath)
  const selectedDistrictIds = params.districtIds ?? []
  const selectedDistrictSet =
    selectedDistrictIds.length > 0 ? new Set(selectedDistrictIds) : null

  const files = new Set<string>()
  files.add(registryPath)

  filterIncludedFilesByDistrict(
    baseDir,
    await collectIncludedReleaseFiles(params.includeGlob),
    selectedDistrictIds,
  ).forEach((entry) => files.add(entry))
  ;(await collectOptionalReleaseFiles(baseDir)).forEach((entry) => files.add(entry))

  const registryDistricts = (registry.districts ?? []).filter(
    (district) => !selectedDistrictSet || selectedDistrictSet.has(district.districtId),
  )

  for (const district of registryDistricts) {
    ;(await collectDistrictReleaseFiles(baseDir, district.districtId)).forEach((entry) =>
      files.add(entry),
    )
  }

  return { baseDir, files: Array.from(files) }
}
