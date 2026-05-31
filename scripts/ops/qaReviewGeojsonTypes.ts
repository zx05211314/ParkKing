import type { FeatureCollection, Point } from 'geojson'

export interface QaReviewGeojsonArgs {
  inputPath: string | null
  outPath: string | null
  json: boolean
}

export interface QaReviewGeojsonParams {
  inputPath: string
  outPath?: string | null
}

export interface QaReviewGeojsonResult {
  inputPath: string
  outPath: string | null
  totalRows: number
  featureCount: number
  skippedRows: number
  collection: FeatureCollection<Point>
  errors: string[]
  warnings: string[]
  pass: boolean
}
