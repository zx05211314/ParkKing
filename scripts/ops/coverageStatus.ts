import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

type PublishStage = 'production' | 'candidate' | 'source-only'
type AnswerCapability = 'full-rule-pipeline' | 'paid-curb-reference-only'

interface CoverageDistrict {
  districtId: string
  districtName: string
  boundaryFeatureId: string
  publishStage: PublishStage
  configPath?: string
  requiresHumanReview: boolean
}

interface CoverageAlias {
  areaId: string
  areaName: string
  parentDistrictId: string
  coverageMode: 'parent-district'
  standaloneBoundaryRequired: boolean
}

interface CoverageRegion {
  regionId: string
  regionName: string
  expectedDistrictCount: number
  answerCapability: AnswerCapability
  sourceManifestPath?: string
  districts: CoverageDistrict[]
  aliases: CoverageAlias[]
  blockers: string[]
}

export interface CoverageManifest {
  schemaVersion: number
  regions: CoverageRegion[]
}

export interface CoverageStatusRow {
  region: string
  district: string
  stage: PublishStage
  capability: AnswerCapability
  config: string
  review: string
}

export interface CoverageStatusResult {
  valid: boolean
  errors: string[]
  rows: CoverageStatusRow[]
  blockers: string[]
}

const PUBLISH_STAGES = new Set<PublishStage>([
  'production',
  'candidate',
  'source-only',
])
const ANSWER_CAPABILITIES = new Set<AnswerCapability>([
  'full-rule-pipeline',
  'paid-curb-reference-only',
])

const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const validateConfiguredDistrict = async (
  district: CoverageDistrict,
  rootDir: string,
  errors: string[],
) => {
  if (!district.configPath) {
    errors.push(`${district.districtId}: ${district.publishStage} district needs configPath`)
    return
  }

  const configPath = path.resolve(rootDir, district.configPath)
  if (!(await fileExists(configPath))) {
    errors.push(`${district.districtId}: config is missing at ${district.configPath}`)
    return
  }

  const config = await readJson<{
    districtId?: string
    boundary?: { featureId?: string | number }
  }>(configPath)
  if (config.districtId !== district.districtId) {
    errors.push(
      `${district.districtId}: config districtId is ${config.districtId ?? 'missing'}`,
    )
  }
  if (String(config.boundary?.featureId ?? '') !== district.boundaryFeatureId) {
    errors.push(
      `${district.districtId}: config boundary.featureId does not match ${district.boundaryFeatureId}`,
    )
  }
}

export const validateCoverageManifest = async (
  manifest: CoverageManifest,
  rootDir = process.cwd(),
): Promise<CoverageStatusResult> => {
  const errors: string[] = []
  const rows: CoverageStatusRow[] = []
  const blockers: string[] = []
  const districtIds = new Set<string>()
  const regionIds = new Set<string>()

  if (manifest.schemaVersion !== 1) {
    errors.push(`Unsupported coverage schemaVersion ${manifest.schemaVersion}`)
  }
  if (!Array.isArray(manifest.regions) || manifest.regions.length === 0) {
    errors.push('Coverage manifest needs at least one region')
    return { valid: false, errors, rows, blockers }
  }

  for (const region of manifest.regions) {
    if (!region.regionId || regionIds.has(region.regionId)) {
      errors.push(`Duplicate or missing regionId: ${region.regionId || 'missing'}`)
    }
    regionIds.add(region.regionId)

    if (!ANSWER_CAPABILITIES.has(region.answerCapability)) {
      errors.push(`${region.regionId}: unsupported answerCapability`)
    }
    if (region.districts.length !== region.expectedDistrictCount) {
      errors.push(
        `${region.regionId}: expected ${region.expectedDistrictCount} districts, found ${region.districts.length}`,
      )
    }
    if (region.sourceManifestPath) {
      const sourceManifestPath = path.resolve(rootDir, region.sourceManifestPath)
      if (!(await fileExists(sourceManifestPath))) {
        errors.push(`${region.regionId}: source manifest is missing`)
      }
    }

    const regionDistrictIds = new Set(region.districts.map(({ districtId }) => districtId))
    for (const district of region.districts) {
      if (!district.districtId || districtIds.has(district.districtId)) {
        errors.push(`Duplicate or missing districtId: ${district.districtId || 'missing'}`)
      }
      districtIds.add(district.districtId)

      if (!PUBLISH_STAGES.has(district.publishStage)) {
        errors.push(`${district.districtId}: unsupported publishStage`)
      }
      if (!district.boundaryFeatureId) {
        errors.push(`${district.districtId}: boundaryFeatureId is required`)
      }
      if (district.publishStage === 'source-only') {
        if (district.configPath) {
          errors.push(`${district.districtId}: source-only district must not declare configPath`)
        }
      } else {
        await validateConfiguredDistrict(district, rootDir, errors)
      }

      rows.push({
        region: region.regionName,
        district: district.districtName,
        stage: district.publishStage,
        capability: region.answerCapability,
        config: district.configPath ?? 'none',
        review: district.requiresHumanReview ? 'required' : 'complete',
      })
    }

    if (
      region.answerCapability === 'paid-curb-reference-only' &&
      region.districts.some(({ publishStage }) => publishStage !== 'source-only')
    ) {
      errors.push(`${region.regionId}: reference-only coverage cannot be publishable`)
    }

    const aliasIds = new Set<string>()
    for (const alias of region.aliases) {
      if (!alias.areaId || aliasIds.has(alias.areaId)) {
        errors.push(`${region.regionId}: duplicate or missing alias areaId`)
      }
      aliasIds.add(alias.areaId)
      if (!regionDistrictIds.has(alias.parentDistrictId)) {
        errors.push(`${region.regionId}/${alias.areaId}: parent district is missing`)
      }
      if (alias.coverageMode !== 'parent-district') {
        errors.push(`${region.regionId}/${alias.areaId}: unsupported coverageMode`)
      }
    }

    blockers.push(...region.blockers.map((blocker) => `${region.regionName}: ${blocker}`))
  }

  return {
    valid: errors.length === 0,
    errors,
    rows,
    blockers,
  }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const run = async () => {
  const manifestPath = path.resolve(
    getArgValue(process.argv, '--manifest') ?? 'configs/coverage.expansion.json',
  )
  const manifest = await readJson<CoverageManifest>(manifestPath)
  const result = await validateCoverageManifest(manifest)

  console.table(result.rows)
  console.log(`Coverage contract: ${result.valid ? 'PASS' : 'FAIL'}`)
  result.blockers.forEach((blocker) => console.log(`BLOCKER: ${blocker}`))
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
