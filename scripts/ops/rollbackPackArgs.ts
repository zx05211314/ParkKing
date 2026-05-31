import type { ParsedRollbackArgs } from './rollbackPackTypes'

export const parseRollbackArgs = (argv: string[]): ParsedRollbackArgs => {
  const args = [...argv]
  const districtIndex = args.findIndex((arg) => arg === '--district')
  const toIndex = args.findIndex((arg) => arg === '--to')
  const latest = args.includes('--latest')
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  return {
    districtId: districtIndex >= 0 ? args[districtIndex + 1] : null,
    backupId: toIndex >= 0 ? args[toIndex + 1] : null,
    latest,
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] : null,
  }
}
