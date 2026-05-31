import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { PackLayout } from './writeMetricsHistoryTypes'

export const metricsHistoryFileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const readMetricsHistoryJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export const detectMetricsPackLayout = async (dir: string): Promise<PackLayout> => {
  const metaPath = path.resolve(dir, 'dataset_meta.json')
  if (await metricsHistoryFileExists(metaPath)) {
    const meta = await readMetricsHistoryJson<Record<string, unknown>>(metaPath)
    const districtId =
      typeof meta.districtId === 'string' && meta.districtId.trim()
        ? meta.districtId
        : path.basename(dir)
    return {
      kind: 'single',
      districts: new Map([[districtId, dir]]),
    }
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const districts = new Map<string, string>()
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (entry.name.startsWith('.') || entry.name === '_ops') {
      continue
    }
    const candidate = path.resolve(dir, entry.name)
    if (await metricsHistoryFileExists(path.resolve(candidate, 'dataset_meta.json'))) {
      districts.set(entry.name, candidate)
    }
  }
  return {
    kind: 'multi',
    districts,
  }
}

export const resolvePreviousMetricsPackDir = async (packDir: string) => {
  const layout = await detectMetricsPackLayout(packDir)
  if (layout.kind !== 'single') {
    return null
  }
  const [districtId] = layout.districts.keys()
  const parent = path.dirname(packDir)
  const parentName = path.basename(parent)
  const baseDir =
    parentName === '.staging' || parentName === '.backup'
      ? path.resolve(parent, '..')
      : parent
  const candidate = path.resolve(baseDir, districtId)
  if (await metricsHistoryFileExists(path.resolve(candidate, 'dataset_meta.json'))) {
    return candidate
  }
  return null
}
