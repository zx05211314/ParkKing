import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DistrictInputChecklistItem } from './checkDistrictInputTypes'

const supportedExtensions = new Set(['.shp', '.geojson', '.json', '.csv'])

const getExtension = (value: string) => path.extname(value).toLowerCase()

export const normalizeDistrictInputPath = (value: string) =>
  value.replace(/\\/g, '/')

export const quickGeojsonGeometryCheck = (raw: string) => {
  const trimmed = raw.trim()
  const geometryTypes = new Set<string>()
  const typeMatches = trimmed.match(/"type"\s*:\s*"([A-Za-z]+)"/g) ?? []
  typeMatches.forEach((match) => {
    const inner = match.match(/"type"\s*:\s*"([A-Za-z]+)"/)
    if (inner?.[1]) {
      geometryTypes.add(inner[1])
    }
  })
  return geometryTypes
}

export const validateDistrictInput = async (params: {
  configDir: string
  key: string
  value: string
}): Promise<DistrictInputChecklistItem> => {
  const { configDir, key, value } = params
  const filePath = path.isAbsolute(value) ? value : path.resolve(configDir, value)
  const ext = getExtension(value)
  const normalizedPath = normalizeDistrictInputPath(value)

  if (!supportedExtensions.has(ext)) {
    return {
      key,
      path: normalizedPath,
      status: 'INVALID',
      detail: `Unsupported extension ${ext}`,
    }
  }

  try {
    const stat = await fs.stat(filePath)
    if (stat.size === 0) {
      return {
        key,
        path: normalizedPath,
        status: 'INVALID',
        detail: 'File size is zero',
      }
    }
    if (ext === '.geojson' || ext === '.json') {
      const raw = await fs.readFile(filePath, 'utf-8')
      const types = quickGeojsonGeometryCheck(raw)
      if (types.size === 0) {
        return {
          key,
          path: normalizedPath,
          status: 'INVALID',
          detail: 'GeoJSON missing type entries',
        }
      }
    }
    return {
      key,
      path: normalizedPath,
      status: 'OK',
    }
  } catch {
    return {
      key,
      path: normalizedPath,
      status: 'MISSING',
    }
  }
}
