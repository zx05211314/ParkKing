import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'

export const PACK_FILES = {
  required: [
    'red_yellow.geojson',
    'bus_stops.geojson',
    'hydrants.geojson',
    'intersections.geojson',
    'intersections_report.json',
  ],
  optional: [
    'parking_spaces.geojson',
    'crosswalks.geojson',
    'sign_overrides.geojson',
    'candidates_inferred.geojson',
    'overrides_applied.geojson',
  ],
}

export const PACK_FILE_LIST = [...PACK_FILES.required, ...PACK_FILES.optional]

export interface FileHashEntry {
  sha256: string
  bytes: number
}

export interface HashSummary {
  files: Record<string, FileHashEntry>
  totalBytes: number
}

const hashBuffer = (buffer: Buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export const hashFiles = async (
  directory: string,
  fileNames: string[] = PACK_FILE_LIST,
): Promise<HashSummary> => {
  const files: Record<string, FileHashEntry> = {}
  let totalBytes = 0

  for (const fileName of fileNames) {
    const filePath = path.resolve(directory, fileName)
    const buffer = await fs.readFile(filePath)
    const bytes = buffer.length
    files[fileName] = {
      sha256: hashBuffer(buffer),
      bytes,
    }
    totalBytes += bytes
  }

  return { files, totalBytes }
}
