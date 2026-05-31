import { featureCollection, point } from '@turf/turf'
import { parse } from 'csv-parse/sync'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import {
  shouldTransformGeometry,
  transformCoord,
  transformGeometry,
} from './ingestCoordinateTransforms'

const parseCoordPair = (value: string): [number, number] | null => {
  const tokens = value.trim().split(/[\s,]+/)
  if (tokens.length < 2) {
    return null
  }
  const lon = Number(tokens[0])
  const lat = Number(tokens[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }
  return [lon, lat]
}

const parseLineStringCoords = (value: string): [number, number][] => {
  return value
    .split(',')
    .map((entry) => parseCoordPair(entry))
    .filter((coord): coord is [number, number] => Boolean(coord))
}

export const parseWktGeometry = (value: string): Geometry | null => {
  const trimmed = value.trim()
  const upper = trimmed.toUpperCase()

  if (upper.startsWith('POINT')) {
    const body = trimmed.replace(/POINT\s*/i, '').replace(/[()]/g, '').trim()
    const coord = parseCoordPair(body)
    if (!coord) {
      return null
    }
    return { type: 'Point', coordinates: coord }
  }

  if (upper.startsWith('LINESTRING')) {
    const body = trimmed.replace(/LINESTRING\s*/i, '').replace(/[()]/g, '').trim()
    const coords = parseLineStringCoords(body)
    if (coords.length < 2) {
      return null
    }
    return { type: 'LineString', coordinates: coords }
  }

  if (upper.startsWith('MULTILINESTRING')) {
    let body = trimmed.replace(/MULTILINESTRING\s*/i, '').trim()
    body = body.replace(/^\(\(/, '').replace(/\)\)$/, '')
    const lines = body
      .split(/\)\s*,\s*\(/)
      .map((segment) => parseLineStringCoords(segment))
      .filter((coords) => coords.length >= 2)
    if (lines.length === 0) {
      return null
    }
    return { type: 'MultiLineString', coordinates: lines }
  }

  return null
}

export const parseCsvDataset = (
  csvText: string,
  defaultCrs: string,
): FeatureCollection => {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
  }) as Record<string, string>[]

  if (records.length === 0) {
    return featureCollection([])
  }

  const headerKeys = Object.keys(records[0] ?? {})
  const keyLookup = headerKeys.map((key) => ({
    key,
    normalized: key.toLowerCase().replace(/\s+/g, ''),
  }))
  const findKey = (candidates: string[]) => {
    const normalizedCandidates = candidates.map((candidate) =>
      candidate.toLowerCase().replace(/\s+/g, ''),
    )
    const hit = keyLookup.find((entry) =>
      normalizedCandidates.some((candidate) => entry.normalized === candidate),
    )
    return hit?.key ?? null
  }
  const findKeyByPattern = (patterns: RegExp[]) => {
    const hit = keyLookup.find((entry) =>
      patterns.some((pattern) => pattern.test(entry.key) || pattern.test(entry.normalized)),
    )
    return hit?.key ?? null
  }

  const explicitLatKey = findKey([
    'wgs84緯度',
    'wgs84緯度座標',
    'wgs緯度',
    'wgs緯度座標',
  ])
  const explicitLonKey = findKey([
    'wgs84經度',
    'wgs84經度座標',
    'wgs經度',
    'wgs經度座標',
  ])
  const explicitXKey = findKey(['97x座標', 'x座標'])
  const explicitYKey = findKey(['97y座標', 'y座標'])

  const latKey = explicitLatKey ?? findKey(['lat', 'latitude', 'lat_wgs84', 'y_wgs84'])
    ?? findKeyByPattern([
      /wgs\s*84.*(lat|latitude|蝺臬漲|蝥砍漲)/iu,
      /(lat|latitude|蝺臬漲|蝥砍漲)/iu,
    ])
  const lonKey =
    explicitLonKey ?? findKey(['lon', 'lng', 'longitude', 'lon_wgs84', 'x_wgs84'])
    ?? findKeyByPattern([
      /wgs\s*84.*(lon|lng|longitude|蝬漲|蝏漲)/iu,
      /(lon|lng|longitude|蝬漲|蝏漲)/iu,
    ])
  const xKey = explicitXKey ?? findKey(['x', 'tm2_x', 'twd97_x', 'x_twd97'])
    ?? findKeyByPattern([/(tm2|twd97|97).*x/iu, /x摨扳?|x??/iu])
  const yKey = explicitYKey ?? findKey(['y', 'tm2_y', 'twd97_y', 'y_twd97'])
    ?? findKeyByPattern([/(tm2|twd97|97).*y/iu, /y摨扳?|y??/iu])
  const wktKey = findKey(['wkt', 'geometry', 'geom'])

  const features: Feature[] = []

  records.forEach((record, index) => {
    if (wktKey && record[wktKey]) {
      const geometry = parseWktGeometry(record[wktKey])
      if (!geometry) {
        return
      }
      const transformed = shouldTransformGeometry(geometry)
        ? transformGeometry(geometry, defaultCrs)
        : geometry
      features.push({
        type: 'Feature',
        geometry: transformed,
        properties: { ...record, _row: index + 1 },
      })
      return
    }

    if (latKey && lonKey) {
      const lat = Number(record[latKey])
      const lon = Number(record[lonKey])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return
      }
      features.push({
        type: 'Feature',
        geometry: point([lon, lat]).geometry,
        properties: { ...record, _row: index + 1 },
      })
      return
    }

    if (xKey && yKey) {
      const x = Number(record[xKey])
      const y = Number(record[yKey])
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return
      }
      const [lon, lat] = transformCoord([x, y], defaultCrs)
      features.push({
        type: 'Feature',
        geometry: point([lon, lat]).geometry,
        properties: { ...record, _row: index + 1 },
      })
    }
  })

  return featureCollection(features)
}
