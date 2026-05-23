import type { SignOverridePreflightArgs } from './signOverridePreflightTypes'

export const parseSignOverridePreflightArgs = (
  argv: string[],
): SignOverridePreflightArgs => {
  const args = [...argv]
  const configIndex = args.findIndex((arg) => arg === '--config')
  const inputIndex = args.findIndex((arg) => arg === '--input')
  const outIndex = args.findIndex((arg) => arg === '--out')

  return {
    configPath: configIndex >= 0 ? args[configIndex + 1] : null,
    inputPath: inputIndex >= 0 ? args[inputIndex + 1] : null,
    json: args.includes('--json'),
    outPath: outIndex >= 0 ? args[outIndex + 1] : null,
  }
}
