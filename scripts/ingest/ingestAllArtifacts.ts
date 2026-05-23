import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import type { ResolvedConfig } from './readConfig'

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const collectCoords = (coords: unknown, result: [number, number][]) => {
  if (!Array.isArray(coords)) {
    return
  }

  if (
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    result.push([coords[0], coords[1]])
    return
  }

  coords.forEach((entry) => collectCoords(entry, result))
}

const bboxFromGeometry = (geometry: Geometry): BBox => {
  const coords: [number, number][] = []
  collectCoords((geometry as Geometry & { coordinates?: unknown }).coordinates, coords)

  if (coords.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  const xs = coords.map((coord) => coord[0])
  const ys = coords.map((coord) => coord[1])

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

export const readBoundaryBBox = async (generatedDir: string, boundaryFile: string) => {
  const boundaryPath = path.resolve(generatedDir, boundaryFile)
  const raw = await fs.readFile(boundaryPath, 'utf-8')
  const collection = JSON.parse(raw) as FeatureCollection
  const boundary = collection.features[0] as Feature<Polygon | MultiPolygon>
  if (!boundary || !boundary.geometry) {
    return null
  }
  return bboxFromGeometry(boundary.geometry)
}

export const formatBBox = (bbox: BBox | null) => {
  if (!bbox) {
    return 'n/a'
  }
  const fmt = (value: number) => value.toFixed(4)
  return `${fmt(bbox.minX)},${fmt(bbox.minY)} -> ${fmt(bbox.maxX)},${fmt(bbox.maxY)}`
}

export const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

export const copyProvenance = async (config: ResolvedConfig) => {
  const provenanceSource = path.resolve(
    process.cwd(),
    'data',
    'sources',
    config.districtId,
    'provenance.json',
  )
  const provenanceDest = path.resolve(config.outputs.generatedDir, 'provenance.json')
  try {
    await fs.copyFile(provenanceSource, provenanceDest)
  } catch {
    // Skip if provenance not available.
  }
}
