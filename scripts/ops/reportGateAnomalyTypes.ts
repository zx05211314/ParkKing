export interface CliArgs {
  districtId: string | null
  packPath: string | null
  outPath: string | null
}

export interface DeltaField {
  prev: number | null
  next: number | null
  delta: number | null
  deltaPct: number | null
}

export interface ParsingFallbackBucket {
  used: boolean
  evidence: string[]
}

export interface ParsingFallbackSummary {
  big5Fallback: ParsingFallbackBucket
  tabDelimiter: ParsingFallbackBucket
  headerMatchFallback: ParsingFallbackBucket
  missingPrjHeuristic: ParsingFallbackBucket
}

export interface InvalidGeometryLayerSummary {
  layer: string
  totalFeatures: number
  nullGeometry: number
  invalidCoordinates: number
  totalInvalid: number
}

export interface GateAnomalyReport {
  schemaVersion: number
  generatedAt: string
  districtId: string
  packPath: string
  outPath: string
  diffReportPath: string | null
  prevPackPath: string | null
  nextPackPath: string
  prevPublishedAt: string | null
  nextPublishedAt: string | null
  prevDistrictIds: string[]
  nextDistrictIds: string[]
  parsingFallbacks: ParsingFallbackSummary
  invalidGeometry: {
    layers: InvalidGeometryLayerSummary[]
    totalInvalid: number
  }
  thresholdDeltas: {
    issues: Array<{
      severity: string
      code: string
      message: string
      metric?: Record<string, unknown>
      threshold?: Record<string, unknown>
    }>
    deltas: Array<{
      field: string
      layer: string
      prev: number | null
      next: number | null
      delta: number | null
      deltaPct: number | null
    }>
  }
  bboxCenterAnomalies: Array<{
    severity: 'INFO' | 'WARN' | 'FAIL'
    code: string
    message: string
    metric?: Record<string, unknown>
  }>
  topOffenders: {
    biggestCountDelta: {
      field: string
      layer: string
      prev: number | null
      next: number | null
      delta: number | null
      deltaPct: number | null
    } | null
    metricTrigger: {
      severity: string
      code: string
      message: string
      metric?: Record<string, unknown>
      threshold?: Record<string, unknown>
    } | null
  }
}

export type ThresholdDeltaEntry = GateAnomalyReport['thresholdDeltas']['deltas'][number]

export {
  DEFAULT_DATASET_ROOTS,
  DELTA_FIELDS,
  KNOWN_LAYER_FILES,
} from './reportGateAnomalyConstants'
