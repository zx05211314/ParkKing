import * as path from 'node:path'
import { buildDistrictDiff } from './diffPackDistricts'
import { detectPackLayout } from './diffPackLayout'
import type { PackDiffReport } from './diffPackTypes'

const DIFF_SCHEMA_VERSION = 1

export const buildPackDiffReport = async (params: {
  prevDir: string | null
  nextDir: string
}): Promise<PackDiffReport> => {
  const nextLayout = await detectPackLayout(params.nextDir)
  const prevLayout = params.prevDir ? await detectPackLayout(params.prevDir) : null

  const districtIds = new Set<string>()
  nextLayout.districts.forEach((_value, key) => districtIds.add(key))
  prevLayout?.districts.forEach((_value, key) => districtIds.add(key))

  const sortedDistricts = Array.from(districtIds).sort((a, b) => a.localeCompare(b))

  const districts = await Promise.all(
    sortedDistricts.map(async (districtId) => {
      const prevDir = prevLayout?.districts.get(districtId) ?? null
      const nextDir = nextLayout.districts.get(districtId) ?? null
      return buildDistrictDiff({ districtId, prevDir, nextDir })
    }),
  )

  const districtsAdded = districts
    .filter((district) => district.status === 'ADDED')
    .map((district) => district.districtId)
  const districtsRemoved = districts
    .filter((district) => district.status === 'REMOVED')
    .map((district) => district.districtId)

  const totalChangedFiles = districts.reduce((sum, district) => {
    return (
      sum +
      district.files.added.length +
      district.files.removed.length +
      district.files.modified.length
    )
  }, 0)

  return {
    schemaVersion: DIFF_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    prevPath: params.prevDir ? path.resolve(params.prevDir) : null,
    nextPath: path.resolve(params.nextDir),
    firstPublish: !params.prevDir,
    districts,
    summary: {
      districtsAdded,
      districtsRemoved,
      totalChangedFiles,
    },
  }
}
