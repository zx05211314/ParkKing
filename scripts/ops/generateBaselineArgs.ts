import type { GenerateBaselinesArgs } from './generateBaselineTypes'

export const parseGenerateBaselinesArgs = (
  argv: string[],
): GenerateBaselinesArgs => {
  const force = argv.includes('--force')
  const seed = argv.includes('--seed')
  const districtArgIndex = argv.findIndex((arg) => arg === '--districtId')
  return {
    force,
    seed,
    districtIdFilter: districtArgIndex >= 0 ? argv[districtArgIndex + 1] ?? null : null,
  }
}
