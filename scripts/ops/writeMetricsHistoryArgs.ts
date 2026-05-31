import type { WriteMetricsHistoryArgs } from './writeMetricsHistoryTypes'

export const parseWriteMetricsHistoryArgs = (
  argv: string[],
): WriteMetricsHistoryArgs => {
  const args = [...argv]
  const packIndex = args.findIndex((arg) => arg === '--pack')
  const prevIndex = args.findIndex((arg) => arg === '--prevPack')
  return {
    packDir: packIndex >= 0 ? args[packIndex + 1] : null,
    prevPackDir: prevIndex >= 0 ? args[prevIndex + 1] : null,
  }
}
