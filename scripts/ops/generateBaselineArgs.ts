import type { GenerateBaselinesArgs } from './generateBaselineTypes'

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${flag} requires a value`)
      }
      return value
    }
  }
  return null
}

export const parseGenerateBaselinesArgs = (
  argv: string[],
): GenerateBaselinesArgs => {
  const force = argv.includes('--force')
  const seed = argv.includes('--seed')
  const generatedRoot =
    getArgValue(argv, '--root', '--generated-root', '--generatedRoot') ??
    'public/data/generated'
  if (!generatedRoot.trim()) {
    throw new Error('--root requires a non-empty value')
  }
  return {
    force,
    seed,
    districtIdFilter: getArgValue(argv, '--districtId', '--district-id'),
    generatedRoot,
  }
}
