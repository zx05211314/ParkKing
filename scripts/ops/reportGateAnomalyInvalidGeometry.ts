import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { summarizeInvalidGeometry } from './reportGateGeometryParsing'
import type { GateAnomalyReport } from './reportGateAnomalyTypes'
import { KNOWN_LAYER_FILES } from './reportGateAnomalyConstants'

export const buildInvalidGeometrySummary = async (
  packPath: string,
): Promise<GateAnomalyReport['invalidGeometry']> => {
  const allFilesInPack = await fs.readdir(packPath)
  const boundaryFiles = allFilesInPack
    .filter((entry) => /_boundary\.geojson$/i.test(entry))
    .sort((a, b) => a.localeCompare(b))
  const layerFiles = [...KNOWN_LAYER_FILES, ...boundaryFiles]
  const layers: GateAnomalyReport['invalidGeometry']['layers'] = []
  for (const fileName of layerFiles) {
    const summary = await summarizeInvalidGeometry(path.resolve(packPath, fileName))
    if (!summary) {
      continue
    }
    layers.push(summary)
  }
  layers.sort((a, b) => a.layer.localeCompare(b.layer))

  return {
    layers,
    totalInvalid: layers.reduce((sum, layer) => sum + layer.totalInvalid, 0),
  }
}
