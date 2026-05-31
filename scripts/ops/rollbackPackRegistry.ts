import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  buildRegistryEntryFromMeta,
  type RegistryEntry,
} from './registryUtils'

interface RollbackRegistryState {
  generatedAt: string
  districts: RegistryEntry[]
}

const createRollbackRegistryState = (): RollbackRegistryState => ({
  generatedAt: new Date().toISOString(),
  districts: [],
})

const readRollbackRegistryState = async (
  registryPath: string,
): Promise<RollbackRegistryState> => {
  try {
    const raw = await fs.readFile(registryPath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      generatedAt?: unknown
      districts?: unknown
    }
    return {
      generatedAt:
        typeof parsed.generatedAt === 'string'
          ? parsed.generatedAt
          : new Date().toISOString(),
      districts: Array.isArray(parsed.districts)
        ? (parsed.districts as RegistryEntry[])
        : [],
    }
  } catch {
    return createRollbackRegistryState()
  }
}

export const updateRollbackRegistry = async (params: {
  baseDir: string
  districtId: string
  metaPath: string
}) => {
  const registryPath = path.resolve(params.baseDir, 'registry.json')
  const registry = await readRollbackRegistryState(registryPath)
  const entry = await buildRegistryEntryFromMeta(params.metaPath, params.districtId)
  const updatedDistricts = registry.districts.filter(
    (existing) => existing.districtId !== params.districtId,
  )
  updatedDistricts.push(entry)

  await fs.writeFile(
    registryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        districts: updatedDistricts,
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )
}
