import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileExists, hasRequiredDatasetFiles } from './sampleQaCandidateDatasetFiles'

const readRegistryDistrictIds = async (datasetRoot: string) => {
  const registryPath = path.resolve(datasetRoot, 'registry.json')
  if (!(await fileExists(registryPath))) {
    return []
  }
  try {
    const raw = await fs.readFile(registryPath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      districts?: Array<{ districtId?: string }>
    }
    return (parsed.districts ?? [])
      .map((entry) => entry.districtId?.trim())
      .filter((entry): entry is string => Boolean(entry))
  } catch {
    return []
  }
}

const readDirectoryDistrictIds = async (datasetRoot: string) => {
  try {
    const entries = await fs.readdir(datasetRoot, { withFileTypes: true })
    const districtIds: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      if (entry.name.startsWith('.') || entry.name === '_ops') {
        continue
      }
      const candidate = path.resolve(datasetRoot, entry.name)
      if (await hasRequiredDatasetFiles(candidate)) {
        districtIds.push(entry.name)
      }
    }
    return districtIds
  } catch {
    return []
  }
}

export const discoverDistrictIds = async (datasetRoots: string[]) => {
  const districtIds = new Set<string>()
  for (const root of datasetRoots) {
    const [registryIds, directoryIds] = await Promise.all([
      readRegistryDistrictIds(root),
      readDirectoryDistrictIds(root),
    ])
    registryIds.forEach((districtId) => districtIds.add(districtId))
    directoryIds.forEach((districtId) => districtIds.add(districtId))
  }
  return Array.from(districtIds).sort((a, b) => a.localeCompare(b))
}
