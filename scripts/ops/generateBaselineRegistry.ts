import * as path from 'node:path'
import { readBaselineJson } from './generateBaselineFiles'
import type { RegistryEntry } from './generateBaselineTypes'

interface GenerateBaselineRegistryPayload {
  districts?: RegistryEntry[]
}

export const loadGenerateBaselineEntries = async (params?: {
  registryPath?: string
  districtIdFilter?: string | null
}) => {
  const registryPath = path.resolve(
    params?.registryPath ?? 'public/data/generated/registry.json',
  )
  const registry = await readBaselineJson<GenerateBaselineRegistryPayload>(registryPath)
  if (!registry.districts || registry.districts.length === 0) {
    throw new Error('registry.json has no districts')
  }

  const entries = params?.districtIdFilter
    ? registry.districts.filter(
        (entry) => entry.districtId === params.districtIdFilter,
      )
    : registry.districts

  if (params?.districtIdFilter && entries.length === 0) {
    throw new Error(`District ${params.districtIdFilter} not found in registry`)
  }

  return {
    registryPath,
    entries,
  }
}
