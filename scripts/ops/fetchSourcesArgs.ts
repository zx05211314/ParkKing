import type { FetchSourcesArgs } from './fetchSourcesTypes'

export const parseFetchSourcesArgs = (argv: string[]): FetchSourcesArgs => {
  const args = [...argv]
  const manifestIndex = args.findIndex((arg) => arg === '--manifest')
  return {
    manifestPath: manifestIndex >= 0 ? args[manifestIndex + 1] : null,
    dryRun: args.includes('--dryRun'),
  }
}
