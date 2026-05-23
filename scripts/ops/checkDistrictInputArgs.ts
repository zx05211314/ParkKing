import type { CheckDistrictInputArgs } from './checkDistrictInputTypes'

export const parseCheckDistrictInputArgs = (
  argv: string[],
): CheckDistrictInputArgs => {
  const args = [...argv]
  const configIndex = args.findIndex((arg) => arg === '--config')
  return {
    configPath: configIndex >= 0 ? args[configIndex + 1] : null,
  }
}
