import type { PublishGateRunSummary } from './publishGateRunSummary'

export type Severity = 'INFO' | 'WARN' | 'FAIL'

export interface GateWarning {
  severity: Severity
  code: string
  message: string
  metric?: Record<string, unknown>
  threshold?: Record<string, unknown>
}

export interface PublishGateOptions {
  reportPath?: string
  mode?: 'strict' | 'warn'
  allowWarn?: boolean
  allowFail?: boolean
  allowBaselineAdopt?: boolean
  overrideReason?: string | null
  outputDir?: string
  datasetRootDir?: string
  publishedRootDir?: string | null
}

export interface PublishGateResult {
  exitCode: number
  summary: PublishGateRunSummary
}

export interface PublishGateReportDistrict {
  districtId?: string
  warnings?: GateWarning[]
  counts?: Record<string, number> | null
  thresholds?: {
    counts?: {
      signOverrides?: number
    }
  }
  validation?: {
    minCounts?: {
      signOverrides?: number
      overridesApplied?: number
    }
  }
}

export interface PublishGateReport {
  generatedAt?: string
  districts?: PublishGateReportDistrict[]
}
