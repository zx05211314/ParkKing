import { loadGateAnomalyPackContext } from './reportGateAnomalyPackContext'
import { loadGateAnomalyParsingFallbacks } from './reportGateAnomalySourceFiles'
import type { GateAnomalyContext } from './reportGateAnomalyContextTypes'

export type { GateAnomalyContext } from './reportGateAnomalyContextTypes'

export const loadGateAnomalyContext = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}): Promise<GateAnomalyContext> => {
  const packContext = await loadGateAnomalyPackContext(params)

  return {
    ...packContext,
    parsingFallbacks: await loadGateAnomalyParsingFallbacks(packContext.meta),
  }
}
