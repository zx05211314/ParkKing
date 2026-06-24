import * as fs from 'node:fs/promises'

const REQUIRED_INPUT_DEFS = [
  { key: 'districtBounds', aliases: ['district_bounds'] },
  { key: 'redYellow', aliases: ['red_yellow'] },
  { key: 'busStops', aliases: ['bus_stops'] },
  { key: 'hydrants', aliases: [] },
] as const

const OPTIONAL_INPUT_DEFS = [
  { key: 'parking_spaces', aliases: ['parkingSpaces'] },
  { key: 'road_centerlines', aliases: ['roadCenterlines'] },
  { key: 'intersections', aliases: ['intersection_points'] },
  { key: 'crosswalks', aliases: ['cross_walks'] },
  { key: 'sign_overrides', aliases: ['signOverrides'] },
  { key: 'candidates_inferred', aliases: ['candidatesInferred'] },
] as const

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export const requiredDistrictInputKeys = REQUIRED_INPUT_DEFS.map(
  ({ key }) => key,
)

const pickDistrictInput = (
  rawInputs: Record<string, string>,
  key: string,
  aliases: readonly string[],
) => {
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

export const resolveDistrictInputs = (config: Record<string, unknown>) => {
  const rawInputs = (config.inputs as Record<string, string>) ?? {}
  const inputs: Record<string, string> = {}

  REQUIRED_INPUT_DEFS.forEach(({ key, aliases }) => {
    inputs[key] = pickDistrictInput(rawInputs, key, aliases) ?? ''
  })

  OPTIONAL_INPUT_DEFS.forEach(({ key, aliases }) => {
    const value = pickDistrictInput(rawInputs, key, aliases)
    if (value) {
      inputs[key] = value
    }
  })

  return inputs
}

export const readDistrictInputConfig = async (configPath: string) => {
  const config = await readJson<Record<string, unknown>>(configPath)
  return {
    config,
    inputs: resolveDistrictInputs(config),
    requiredKeys: requiredDistrictInputKeys,
  }
}
