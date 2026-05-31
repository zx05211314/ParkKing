import type { BenchmarkResult } from '../bench/benchEvaluate'
import type {
  BaselineMetrics,
  OpsThresholds,
  Warning,
} from '../ops/compareBaseline'
import type { RegistryEntry } from '../ops/registryUtils'
import type { BBox } from './ingestAllArtifacts'
import type { PublishResult } from './publishPackAtomic'
import type { ResolvedConfig } from './readConfig'

export interface IngestDistrictSummary {
  districtId: string
  label: string
  datasetHash: string
  counts: Record<string, number> | null
  bbox: BBox | null
  dayEval: BenchmarkResult | null
  nightEval: BenchmarkResult | null
  intersectionsReport: Record<string, unknown> | null
  riskTagCounts: Record<string, number> | null
  districtName: string | null
  schemaVersion: number | null
  generatedAt: string | null
  warnings: Warning[]
  baselineStatus: 'missing' | 'loaded'
  baselineCandidate: BaselineMetrics | null
  thresholds: OpsThresholds
  retention: ResolvedConfig['ops']['retention']
  validation?: ResolvedConfig['validation']
  config: ResolvedConfig
  registryEntry?: RegistryEntry
  publishResult?: PublishResult
  baselineUsed?: {
    baselineDatasetHash?: string
    baselineCreatedAt?: string
  }
}

export interface IngestAllReportDistrict {
  districtId: string
  districtName: string
  datasetHash: string
  schemaVersion: number | null
  generatedAt: string | null
  counts: Record<string, number> | null
  bbox: BBox | null
  intersectionsReport: Record<string, unknown> | null
  riskTagCounts: Record<string, number> | null
  evaluations: {
    day: BenchmarkResult | null
    night: BenchmarkResult | null
  }
  reasonCodes:
    | {
        day: BenchmarkResult['reasonCodes']
        night: BenchmarkResult['reasonCodes']
      }
    | null
  thresholds: OpsThresholds
  validation?: ResolvedConfig['validation']
  baselineStatus: 'missing' | 'loaded'
  baselineCandidate: BaselineMetrics | null
  warnings: Warning[]
}

export interface IngestAllReport {
  generatedAt: string
  districts: IngestAllReportDistrict[]
}
