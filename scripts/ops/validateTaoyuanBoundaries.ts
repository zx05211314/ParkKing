import { fileURLToPath } from 'node:url'
import type { FeatureCollection, Geometry } from 'geojson'
import { EPSG_4326 } from '../ingest/ingestCrs'
import { readDataset } from '../ingest/ingestDatasetRead'

const DEFAULT_INPUT =
  'data/sources/taoyuan/town_boundaries/town_boundaries.shp'

const EXPECTED_DISTRICTS = new Map([
  ['68000010', 'Taoyuan District'],
  ['68000020', 'Zhongli District'],
  ['68000030', 'Daxi District'],
  ['68000040', 'Yangmei District'],
  ['68000050', 'Luzhu District'],
  ['68000060', 'Dayuan District'],
  ['68000070', 'Guishan District'],
  ['68000080', 'Bade District'],
  ['68000090', 'Longtan District'],
  ['68000100', 'Pingzhen District'],
  ['68000110', 'Xinwu District'],
  ['68000120', 'Guanyin District'],
  ['68000130', 'Fuxing District'],
])

interface BoundaryRow {
  townCode: string
  townId: string
  name: string
  geometry: string
}

const collectCoordinates = (
  value: unknown,
  coordinates: Array<[number, number]>,
) => {
  if (!Array.isArray(value)) {
    return
  }
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    coordinates.push([value[0], value[1]])
    return
  }
  value.forEach((entry) => collectCoordinates(entry, coordinates))
}

const isPlausibleTaoyuanGeometry = (geometry: Geometry | null) => {
  if (!geometry) {
    return false
  }
  const coordinates: Array<[number, number]> = []
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries.forEach((entry) => {
      if ('coordinates' in entry) {
        collectCoordinates(entry.coordinates, coordinates)
      }
    })
  } else {
    collectCoordinates(geometry.coordinates, coordinates)
  }
  return (
    coordinates.length > 0 &&
    coordinates.every(
      ([longitude, latitude]) =>
        longitude >= 120 && longitude <= 122 && latitude >= 24 && latitude <= 26,
    )
  )
}

export const validateTaoyuanBoundaryCollection = (
  collection: FeatureCollection,
) => {
  const errors: string[] = []
  const rows: BoundaryRow[] = []
  const seenCodes = new Set<string>()
  const taoyuanFeatures = collection.features.filter(
    ({ properties }) => String(properties?.COUNTYCODE ?? '') === '68000',
  )

  for (const feature of taoyuanFeatures) {
    const townCode = String(feature.properties?.TOWNCODE ?? '')
    if (!EXPECTED_DISTRICTS.has(townCode)) {
      errors.push(`Unexpected Taoyuan TOWNCODE ${townCode || 'missing'}`)
      continue
    }
    if (seenCodes.has(townCode)) {
      errors.push(`Duplicate Taoyuan TOWNCODE ${townCode}`)
    }
    seenCodes.add(townCode)
    if (!isPlausibleTaoyuanGeometry(feature.geometry)) {
      errors.push(`${townCode}: boundary coordinates are outside the Taoyuan range`)
    }
    rows.push({
      townCode,
      townId: String(feature.properties?.TOWNID ?? ''),
      name: String(feature.properties?.TOWNENG ?? EXPECTED_DISTRICTS.get(townCode)),
      geometry: feature.geometry?.type ?? 'missing',
    })
  }

  EXPECTED_DISTRICTS.forEach((_name, townCode) => {
    if (!seenCodes.has(townCode)) {
      errors.push(`Missing Taoyuan TOWNCODE ${townCode}`)
    }
  })
  rows.sort((left, right) => left.townCode.localeCompare(right.townCode))
  return { valid: errors.length === 0, errors, rows }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const run = async () => {
  const inputPath = getArgValue(process.argv, '--input') ?? DEFAULT_INPUT
  const collection = await readDataset(inputPath, EPSG_4326)
  const result = validateTaoyuanBoundaryCollection(collection)
  console.table(result.rows)
  console.log(`Taoyuan boundaries: ${result.valid ? 'PASS' : 'FAIL'}`)
  if (!result.valid) {
    throw new Error(result.errors.join('\n'))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
