import type { NewDistrictCliArgs } from './newDistrictTypes'

export const NEW_DISTRICT_USAGE =
  'Usage: tsx scripts/ops/newDistrict.ts --districtId <id> --districtName "<name>" --sourceRoot "data/raw/<id>" [--outputRoot configs/expansion] [--sourcePreset raw-district|taipei-shared] [--boundaryFeatureId <id>]'

const getArgValue = (args: string[], flag: string) => {
  const index = args.findIndex((arg) => arg === flag)
  return index >= 0 && args[index + 1] ? args[index + 1] : null
}

const parseSourcePreset = (value: string | null) => {
  if (value === null) {
    return null
  }
  if (value === 'raw-district' || value === 'taipei-shared') {
    return value
  }
  throw new Error(`Unsupported source preset: ${value}`)
}

export const parseArgs = (argv: string[]): NewDistrictCliArgs => {
  const args = [...argv]
  return {
    districtId: getArgValue(args, '--districtId'),
    districtName: getArgValue(args, '--districtName'),
    sourceRoot: getArgValue(args, '--sourceRoot'),
    outputRoot: getArgValue(args, '--outputRoot'),
    sourcePreset: parseSourcePreset(getArgValue(args, '--sourcePreset')),
    boundaryFeatureId: getArgValue(args, '--boundaryFeatureId'),
    boundaryName: getArgValue(args, '--boundaryName'),
    force: args.includes('--force'),
  }
}
