import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import fg from 'fast-glob'
import type { LatestPointer } from './packageReleaseTypes'
import { readReleaseJson, resolveReleaseManifestPath } from './packageReleaseUtils'

const readLatestReleasePointer = async (latestPath: string) => {
  try {
    return await readReleaseJson<LatestPointer>(latestPath)
  } catch {
    return null
  }
}

const collectDistrictManifestFiles = async (
  baseDir: string,
  districtId: string,
  latest: LatestPointer | null,
) => {
  const manifestPath = resolveReleaseManifestPath(baseDir, latest?.manifestPath)
  if (!manifestPath) {
    return []
  }

  try {
    await fs.access(manifestPath)
    return [manifestPath]
  } catch {
    const manifestDir = path.resolve(baseDir, '_ops', 'manifests', districtId)
    const manifestFiles = await fg(`${manifestDir.replace(/\\/g, '/')}/**`, {
      onlyFiles: true,
    })
    return manifestFiles.map((entry) => path.resolve(entry))
  }
}

export const collectDistrictReleaseFiles = async (baseDir: string, districtId: string) => {
  const districtDir = path.resolve(baseDir, districtId)
  const districtFiles = await fg(`${districtDir.replace(/\\/g, '/')}/**`, {
    onlyFiles: true,
  })
  const latestPath = path.resolve(districtDir, 'LATEST.json')
  const latest = await readLatestReleasePointer(latestPath)

  return [
    ...districtFiles.map((entry) => path.resolve(entry)),
    ...(await collectDistrictManifestFiles(baseDir, districtId, latest)),
  ]
}
