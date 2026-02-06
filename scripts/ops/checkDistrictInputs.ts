import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const configIndex = args.findIndex((arg) => arg === '--config')
  return {
    configPath: configIndex >= 0 ? args[configIndex + 1] : null,
  }
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const getExtension = (value: string) => path.extname(value).toLowerCase()

const supportedExtensions = new Set(['.shp', '.geojson', '.json', '.csv'])

const normalizePath = (value: string) => value.replace(/\\/g, '/')

const quickGeojsonGeometryCheck = (raw: string) => {
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

export const checkDistrictInputs = async (configPath: string) => {
  const configDir = path.dirname(configPath)
  const config = await readJson<Record<string, unknown>>(configPath)
  const rawInputs = (config.inputs as Record<string, string>) ?? {}
  const pickInput = (key: string, aliases: string[] = []) => {
    if (rawInputs[key]) {
      return rawInputs[key]
    }
    for (const alias of aliases) {
      if (rawInputs[alias]) {
        return rawInputs[alias]
      }
    }
    return undefined
  }
  const inputs: Record<string, string> = {}
  inputs.districtBounds = pickInput('districtBounds', ['district_bounds']) ?? ''
  inputs.redYellow = pickInput('redYellow', ['red_yellow']) ?? ''
  inputs.busStops = pickInput('busStops', ['bus_stops']) ?? ''
  inputs.hydrants = pickInput('hydrants', ['hydrants']) ?? ''
  const optionalKeys = [
    { key: 'road_centerlines', aliases: ['roadCenterlines'] },
    { key: 'intersections', aliases: ['intersection_points'] },
    { key: 'crosswalks', aliases: ['cross_walks'] },
    { key: 'sign_overrides', aliases: ['signOverrides'] },
    { key: 'candidates_inferred', aliases: ['candidatesInferred'] },
  ]
  optionalKeys.forEach(({ key, aliases }) => {
    const value = pickInput(key, aliases)
    if (value) {
      inputs[key] = value
    }
  })
  const requiredKeys = ['districtBounds', 'redYellow', 'busStops', 'hydrants']

  const checklist: Array<{
    key: string
    path: string
    status: 'OK' | 'MISSING' | 'INVALID'
    detail?: string
  }> = []

  for (const [key, value] of Object.entries(inputs)) {
    if (!value) {
      continue
    }
    const filePath = path.isAbsolute(value)
      ? value
      : path.resolve(configDir, value)
    const ext = getExtension(value)
    if (!supportedExtensions.has(ext)) {
      checklist.push({
        key,
        path: normalizePath(value),
        status: 'INVALID',
        detail: `Unsupported extension ${ext}`,
      })
      continue
    }

    try {
      const stat = await fs.stat(filePath)
      if (stat.size === 0) {
        checklist.push({
          key,
          path: normalizePath(value),
          status: 'INVALID',
          detail: 'File size is zero',
        })
        continue
      }
      if (ext === '.geojson' || ext === '.json') {
        const raw = await fs.readFile(filePath, 'utf-8')
        const types = quickGeojsonGeometryCheck(raw)
        if (types.size === 0) {
          checklist.push({
            key,
            path: normalizePath(value),
            status: 'INVALID',
            detail: 'GeoJSON missing type entries',
          })
          continue
        }
      }
      checklist.push({
        key,
        path: normalizePath(value),
        status: 'OK',
      })
    } catch {
      checklist.push({
        key,
        path: normalizePath(value),
        status: 'MISSING',
      })
    }
  }

  const missingRequired = requiredKeys.filter(
    (key) => !inputs[key] || checklist.find((item) => item.key === key)?.status !== 'OK',
  )

  console.table(
    checklist.map((item) => ({
      input: item.key,
      path: item.path,
      status: item.status,
      detail: item.detail ?? '',
    })),
  )

  if (missingRequired.length > 0) {
    throw new Error(`Missing required inputs: ${missingRequired.join(', ')}`)
  }

  return checklist
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.configPath) {
    throw new Error('Usage: tsx scripts/ops/checkDistrictInputs.ts --config <path>')
  }
  await checkDistrictInputs(args.configPath)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
