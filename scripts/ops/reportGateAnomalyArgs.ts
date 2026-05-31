import type { CliArgs } from './reportGateAnomalyTypes'

export const parseReportGateAnomalyArgs = (argv: string[]): CliArgs => {
  const args = [...argv]
  const districtIndex = args.findIndex((arg) => arg === '--district')
  const packIndex = args.findIndex((arg) => arg === '--pack')
  const outIndex = args.findIndex((arg) => arg === '--out')
  return {
    districtId: districtIndex >= 0 ? args[districtIndex + 1] ?? null : null,
    packPath: packIndex >= 0 ? args[packIndex + 1] ?? null : null,
    outPath: outIndex >= 0 ? args[outIndex + 1] ?? null : null,
  }
}
