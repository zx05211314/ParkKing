import type { NewDistrictCliArgs } from './newDistrictTypes'

export const NEW_DISTRICT_USAGE =
  'Usage: tsx scripts/ops/newDistrict.ts --districtId <id> --districtName "<name>" --sourceRoot "data/raw/<id>"'

export const parseArgs = (argv: string[]): NewDistrictCliArgs => {
  const args = [...argv]
  const idIndex = args.findIndex((arg) => arg === '--districtId')
  const nameIndex = args.findIndex((arg) => arg === '--districtName')
  const sourceIndex = args.findIndex((arg) => arg === '--sourceRoot')
  return {
    districtId: idIndex >= 0 ? args[idIndex + 1] : null,
    districtName: nameIndex >= 0 ? args[nameIndex + 1] : null,
    sourceRoot: sourceIndex >= 0 ? args[sourceIndex + 1] : null,
    force: args.includes('--force'),
  }
}
