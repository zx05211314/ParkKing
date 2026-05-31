import * as path from 'node:path'
import type { Geometry } from 'geojson'
import { fileExists, readJson } from './diffPackFiles'
import { hasValidCoordinates } from './reportGateGeometryCoordinates'
import type { InvalidGeometryLayerSummary } from './reportGateAnomalyTypes'

export const summarizeInvalidGeometry = async (
  filePath: string,
): Promise<InvalidGeometryLayerSummary | null> => {
  if (!(await fileExists(filePath))) {
    return null
  }

  let parsed: { features?: Array<{ geometry?: Geometry | null }> } | null = null
  try {
    parsed = await readJson<{ features?: Array<{ geometry?: Geometry | null }> }>(filePath)
  } catch {
    return {
      layer: path.basename(filePath),
      totalFeatures: 0,
      nullGeometry: 0,
      invalidCoordinates: 0,
      totalInvalid: 1,
    }
  }

  const features = parsed?.features ?? []
  let nullGeometry = 0
  let invalidCoordinates = 0
  features.forEach((feature) => {
    if (!feature.geometry) {
      nullGeometry += 1
      return
    }
    if (!hasValidCoordinates(feature.geometry)) {
      invalidCoordinates += 1
    }
  })
  return {
    layer: path.basename(filePath),
    totalFeatures: features.length,
    nullGeometry,
    invalidCoordinates,
    totalInvalid: nullGeometry + invalidCoordinates,
  }
}
