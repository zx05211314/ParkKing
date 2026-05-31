import type {
  PublishGateBaselineAdoptState,
  PublishGateBootstrapState,
} from './publishGateDecision'
import type {
  PublishGateDistrictSummary,
  PublishGateTotals,
} from './publishGateSummary'
import { buildPublishGateBaselineAdoptSummary } from './publishGateRunSummaryBaselineAdopt'
import { buildPublishGateBootstrapSummary } from './publishGateRunSummaryBootstrap'

export interface PublishGateRunSummary {
  generatedAt: string
  reportPath: string
  mode: 'strict' | 'warn'
  allowWarn: boolean
  allowFail: boolean
  allowFailRequested: boolean
  allowBaselineAdopt: boolean
  overrideReason: string | null
  bootstrap: {
    requested: boolean
    modeUsed: boolean
    denied: boolean
    previousPackExists: boolean
  }
  baselineAdopt: {
    enabled: boolean
    applied: boolean
    districtIds: string[]
    reason: 'baseline_adopt' | null
  }
  gateMessageFlags: string[]
  totals: PublishGateTotals
  districts: PublishGateDistrictSummary[]
  exitCode: number
}

export interface BuildPublishGateRunSummaryOptions {
  reportPath: string
  mode: 'strict' | 'warn'
  allowWarn: boolean
  allowFailRequested: boolean
  allowBaselineAdopt: boolean
  overrideReason: string | null
  bootstrapState: PublishGateBootstrapState
  baselineAdoptState: PublishGateBaselineAdoptState
  totals: PublishGateTotals
  districts: PublishGateDistrictSummary[]
  exitCode: number
}

export const buildPublishGateRunSummary = ({
  reportPath,
  mode,
  allowWarn,
  allowFailRequested,
  allowBaselineAdopt,
  overrideReason,
  bootstrapState,
  baselineAdoptState,
  totals,
  districts,
  exitCode,
}: BuildPublishGateRunSummaryOptions): PublishGateRunSummary => ({
  generatedAt: new Date().toISOString(),
  reportPath,
  mode,
  allowWarn,
  allowFail: bootstrapState.effectiveAllowFail,
  allowFailRequested,
  allowBaselineAdopt,
  overrideReason,
  bootstrap: buildPublishGateBootstrapSummary(bootstrapState),
  baselineAdopt: buildPublishGateBaselineAdoptSummary({
    allowBaselineAdopt,
    baselineAdoptState,
  }),
  gateMessageFlags: baselineAdoptState.gateMessageFlags,
  totals,
  districts,
  exitCode,
})
