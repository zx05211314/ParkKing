import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import type { FeatureCollection } from 'geojson'
import type { PublishGateReport } from './publishGateTypes'

export const resolveDefaultPublishGateReport = async () => {
  const primary = path.resolve('public/data/generated/ingest_all_report.json')
  try {
    await fs.access(primary)
    return primary
  } catch {
    return path.resolve('data/generated/ingest_all_report.json')
  }
}

export const loadPublishGateReport = async (reportPath: string): Promise<PublishGateReport> => {
  const raw = await fs.readFile(reportPath, 'utf-8')
  return JSON.parse(raw) as PublishGateReport
}

export const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')

export const hashFile = async (filePath: string) => {
  const buffer = await fs.readFile(filePath)
  return { sha256: sha256(buffer), bytes: buffer.length }
}

export const readGeoJson = async (filePath: string): Promise<FeatureCollection> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as FeatureCollection
}
