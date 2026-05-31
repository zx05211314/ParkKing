import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileExists } from './diffPackJson'
import { readMeta } from './diffPackMetaState'

export interface DiffPackLayout {
  kind: 'single' | 'multi'
  districts: Map<string, string>
}

export const detectPackLayout = async (dir: string): Promise<DiffPackLayout> => {
  const metaPath = path.resolve(dir, 'dataset_meta.json')
  if (await fileExists(metaPath)) {
    const meta = await readMeta(dir)
    const districtId =
      meta && typeof meta.districtId === 'string' && meta.districtId.trim()
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
    if (await fileExists(path.resolve(candidate, 'dataset_meta.json'))) {
      districts.set(entry.name, candidate)
    }
  }

  return {
    kind: 'multi',
    districts,
  }
}

export const resolvePrevFromNext = async (nextDir: string) => {
  const layout = await detectPackLayout(nextDir)
  if (layout.kind !== 'single') {
    return null
  }
  const [districtId] = layout.districts.keys()
  const parent = path.dirname(nextDir)
  const parentName = path.basename(parent)
  const baseDir =
    parentName === '.staging' || parentName === '.backup'
      ? path.resolve(parent, '..')
      : parent
  const candidate = path.resolve(baseDir, districtId)
  if (await fileExists(path.resolve(candidate, 'dataset_meta.json'))) {
    return candidate
  }
  return null
}
