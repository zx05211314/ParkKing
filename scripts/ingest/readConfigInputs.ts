import * as path from 'node:path'
import type { IngestConfig, ResolvedConfig } from './readConfigTypes'

export const parseConfigArg = (argv: string[]) => {
  const args = [...argv]
  const configIndex = args.findIndex((arg) => arg === '--config' || arg === '-c')
  if (configIndex >= 0 && args[configIndex + 1]) {
    return args[configIndex + 1]
  }
  return null
}

export const resolveMaybeRelative = (configDir: string, target: string) => {
  return path.isAbsolute(target) ? target : path.resolve(configDir, target)
}

const pickInput = (
  inputsRaw: Record<string, string | undefined>,
  key: string,
  aliases: string[] = [],
) => {
  const direct = inputsRaw[key]
  if (direct) {
    return direct
  }
  for (const alias of aliases) {
    const value = inputsRaw[alias]
    if (value) {
      return value
    }
  }
  return undefined
}

export const resolveConfigInputs = (
  parsed: IngestConfig,
  configDir: string,
): ResolvedConfig['inputs'] => {
  if (!parsed.inputs) {
    throw new Error('Config missing inputs section.')
  }

  const inputsRaw = parsed.inputs as Record<string, string | undefined>
  const requiredInputs = ['districtBounds', 'redYellow', 'busStops', 'hydrants'] as const
  for (const key of requiredInputs) {
    const value = pickInput(inputsRaw, key, [
      key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`),
    ])
    if (!value) {
      throw new Error(`Config missing inputs.${key}`)
    }
  }

  return {
    districtBounds: resolveMaybeRelative(
      configDir,
      pickInput(inputsRaw, 'districtBounds', ['district_bounds']) ?? '',
    ),
    redYellow: resolveMaybeRelative(
      configDir,
      pickInput(inputsRaw, 'redYellow', ['red_yellow']) ?? '',
    ),
    busStops: resolveMaybeRelative(
      configDir,
      pickInput(inputsRaw, 'busStops', ['bus_stops']) ?? '',
    ),
    hydrants: resolveMaybeRelative(
      configDir,
      pickInput(inputsRaw, 'hydrants', ['hydrants']) ?? '',
    ),
    parking_spaces: pickInput(inputsRaw, 'parking_spaces', ['parkingSpaces'])
      ? resolveMaybeRelative(
          configDir,
          pickInput(inputsRaw, 'parking_spaces', ['parkingSpaces']) ?? '',
        )
      : undefined,
    road_centerlines: pickInput(inputsRaw, 'road_centerlines', ['roadCenterlines'])
      ? resolveMaybeRelative(
          configDir,
          pickInput(inputsRaw, 'road_centerlines', ['roadCenterlines']) ?? '',
        )
      : undefined,
    intersections: pickInput(inputsRaw, 'intersections', ['intersection_points'])
      ? resolveMaybeRelative(
          configDir,
          pickInput(inputsRaw, 'intersections', ['intersection_points']) ?? '',
        )
      : undefined,
    crosswalks: pickInput(inputsRaw, 'crosswalks', ['cross_walks'])
      ? resolveMaybeRelative(
          configDir,
          pickInput(inputsRaw, 'crosswalks', ['cross_walks']) ?? '',
        )
      : undefined,
    sign_overrides: pickInput(inputsRaw, 'sign_overrides', ['signOverrides'])
      ? resolveMaybeRelative(
          configDir,
          pickInput(inputsRaw, 'sign_overrides', ['signOverrides']) ?? '',
        )
      : undefined,
    candidates_inferred: pickInput(inputsRaw, 'candidates_inferred', ['candidatesInferred'])
      ? resolveMaybeRelative(
          configDir,
          pickInput(inputsRaw, 'candidates_inferred', ['candidatesInferred']) ?? '',
        )
      : undefined,
  }
}
