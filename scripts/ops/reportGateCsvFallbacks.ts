import * as fs from 'node:fs/promises'
import { TextDecoder } from 'node:util'

const normalizeForCompare = (value: string) => value.toLowerCase().replace(/\s+/g, '')

export const analyzeCsvHeaderFallbacks = (firstLine: string) => {
  if (!firstLine) {
    return { tabDelimiter: false, headerMatchFallback: false }
  }
  const tabDelimiter = firstLine.includes('\t') && !firstLine.includes(',')
  const delimiter = tabDelimiter ? '\t' : ','
  const headers = firstLine
    .split(delimiter)
    .map((header) => header.trim())
    .filter(Boolean)
  if (headers.length === 0) {
    return { tabDelimiter, headerMatchFallback: false }
  }

  const normalized = headers.map((header) => normalizeForCompare(header))
  const hasDirectLat = normalized.some((key) =>
    ['lat', 'latitude', 'lat_wgs84', 'y_wgs84'].includes(key),
  )
  const hasDirectLon = normalized.some((key) =>
    ['lon', 'lng', 'longitude', 'lon_wgs84', 'x_wgs84'].includes(key),
  )
  const hasDirectX = normalized.some((key) =>
    ['x', 'tm2_x', 'twd97_x', 'x_twd97'].includes(key),
  )
  const hasDirectY = normalized.some((key) =>
    ['y', 'tm2_y', 'twd97_y', 'y_twd97'].includes(key),
  )
  const hasDirect = (hasDirectLat && hasDirectLon) || (hasDirectX && hasDirectY)
  const patternHit = headers.some((header) =>
    /wgs|tm2|twd97|lat|lon|lng|longitude|latitude|x|y/i.test(header),
  )

  return {
    tabDelimiter,
    headerMatchFallback: !hasDirect && patternHit,
  }
}

export const analyzeCsvFallbackFile = async (filePath: string) => {
  const buffer = await fs.readFile(filePath)
  let decodedText = ''
  let utf8Valid = true
  try {
    decodedText = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    utf8Valid = false
    decodedText = new TextDecoder('big5').decode(buffer)
  }

  const firstLine = decodedText.split(/\r?\n/, 1)[0] ?? ''
  const headerAnalysis = analyzeCsvHeaderFallbacks(firstLine)

  return {
    big5Fallback: !utf8Valid,
    tabDelimiter: headerAnalysis.tabDelimiter,
    headerMatchFallback: headerAnalysis.headerMatchFallback,
  }
}
