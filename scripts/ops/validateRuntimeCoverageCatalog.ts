import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseRuntimeCoverageCatalog,
  type RuntimeCoverageCatalog,
} from '../../src/data/coverageCatalog'
import {
  getPaidCurbReferenceUrl,
  parsePaidCurbReferencePack,
  type PaidCurbReferencePack,
} from '../../src/data/paidCurbReference'
import type { CoverageManifest } from './coverageStatus'

const DEFAULT_MANIFEST = 'configs/coverage.expansion.json'
const DEFAULT_CATALOG = 'public/data/coverage.json'
const DEFAULT_TAOYUAN_REFERENCE =
  'public/data/reference/taoyuan-paid-curb.json'

const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown

export const validateRuntimeCoverageCatalog = (
  manifest: CoverageManifest,
  catalog: RuntimeCoverageCatalog,
) => {
  const errors: string[] = []
  const expected = new Map(
    manifest.regions.flatMap((region) =>
      region.districts.map((district) => [
        district.districtId,
        {
          region,
          district,
          aliases: region.aliases
            .filter(
              ({ parentDistrictId }) =>
                parentDistrictId === district.districtId,
            )
            .map(
              ({
                areaId,
                areaName,
                coverageMode,
                standaloneBoundaryRequired,
              }) => ({
                areaId,
                areaName,
                coverageMode,
                standaloneBoundaryRequired,
              }),
            ),
        },
      ] as const),
    ),
  )
  const actualIds = new Set<string>()

  for (const actual of catalog.districts) {
    if (actualIds.has(actual.districtId)) {
      errors.push(`${actual.districtId}: duplicate catalog district`)
      continue
    }
    actualIds.add(actual.districtId)
    const expectedEntry = expected.get(actual.districtId)
    if (!expectedEntry) {
      errors.push(`${actual.districtId}: district is not in the coverage manifest`)
      continue
    }
    const { region, district, aliases } = expectedEntry
    const comparisons: Array<[string, unknown, unknown]> = [
      ['regionId', actual.regionId, region.regionId],
      ['regionName', actual.regionName, region.regionName],
      ['districtName', actual.districtName, district.districtName],
      ['boundaryFeatureId', actual.boundaryFeatureId, district.boundaryFeatureId],
      ['publishStage', actual.publishStage, district.publishStage],
      ['answerCapability', actual.answerCapability, region.answerCapability],
      ['requiresHumanReview', actual.requiresHumanReview, district.requiresHumanReview],
      ['aliases', JSON.stringify(actual.aliases), JSON.stringify(aliases)],
    ]
    comparisons.forEach(([field, actualValue, expectedValue]) => {
      if (actualValue !== expectedValue) {
        errors.push(
          `${actual.districtId}: ${field} is ${String(actualValue)}, expected ${String(expectedValue)}`,
        )
      }
    })
    if (
      region.answerCapability === 'paid-curb-reference-only' &&
      !actual.referenceData
    ) {
      errors.push(`${actual.districtId}: reference-only district is missing referenceData`)
    }
    if (
      region.answerCapability === 'full-rule-pipeline' &&
      actual.referenceData
    ) {
      errors.push(`${actual.districtId}: full-rule district must not declare referenceData`)
    }
  }

  expected.forEach((_entry, districtId) => {
    if (!actualIds.has(districtId)) {
      errors.push(`${districtId}: district is missing from the runtime catalog`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    districtCount: catalog.districts.length,
  }
}

export const validateRuntimeCoverageReferences = (
  catalog: RuntimeCoverageCatalog,
  pack: PaidCurbReferencePack,
) => {
  const errors: string[] = []
  const taoyuanDistricts = new Map(
    catalog.districts
      .filter(({ regionId }) => regionId === pack.regionId)
      .map((district) => [district.districtId, district]),
  )
  for (const referenceDistrict of pack.districts) {
    const catalogDistrict = taoyuanDistricts.get(referenceDistrict.districtId)
    if (!catalogDistrict) {
      errors.push(
        `${referenceDistrict.districtId}: reference district is missing from catalog`,
      )
      continue
    }
    taoyuanDistricts.delete(referenceDistrict.districtId)
    const referenceData = catalogDistrict.referenceData
    if (!referenceData) {
      errors.push(`${referenceDistrict.districtId}: catalog referenceData is missing`)
      continue
    }
    const comparisons: Array<[string, unknown, unknown]> = [
      [
        'boundaryFeatureId',
        catalogDistrict.boundaryFeatureId,
        referenceDistrict.boundaryFeatureId,
      ],
      ['recordCount', referenceData.recordCount, referenceDistrict.recordCount],
      ['sourceSha256', referenceData.sourceSha256, pack.source.sha256],
      ['url', referenceData.url, getPaidCurbReferenceUrl()],
      ['geometryAvailable', referenceData.geometryAvailable, false],
      ['legalAnswerEligible', referenceData.legalAnswerEligible, false],
      ['requiresHumanReview', referenceData.requiresHumanReview, true],
    ]
    comparisons.forEach(([field, actualValue, expectedValue]) => {
      if (actualValue !== expectedValue) {
        errors.push(
          `${referenceDistrict.districtId}: reference ${field} is ${String(actualValue)}, expected ${String(expectedValue)}`,
        )
      }
    })
  }
  taoyuanDistricts.forEach((_district, districtId) => {
    errors.push(`${districtId}: catalog district is missing from reference pack`)
  })
  return errors
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const run = async () => {
  const manifestPath = path.resolve(
    getArgValue(process.argv, '--manifest') ?? DEFAULT_MANIFEST,
  )
  const catalogPath = path.resolve(
    getArgValue(process.argv, '--catalog') ?? DEFAULT_CATALOG,
  )
  const manifest = (await readJson(manifestPath)) as CoverageManifest
  const catalog = parseRuntimeCoverageCatalog(await readJson(catalogPath))
  const result = validateRuntimeCoverageCatalog(manifest, catalog)
  const referenceErrors = manifest.regions.some(
    ({ regionId }) => regionId === 'taoyuan',
  )
    ? validateRuntimeCoverageReferences(
        catalog,
        parsePaidCurbReferencePack(
          await readJson(
            path.resolve(
              getArgValue(process.argv, '--taoyuan-reference') ??
                DEFAULT_TAOYUAN_REFERENCE,
            ),
          ),
        ),
      )
    : []
  const errors = [...result.errors, ...referenceErrors]
  console.log(
    `Runtime coverage catalog: ${errors.length === 0 ? 'PASS' : 'FAIL'} (${result.districtCount} districts)`,
  )
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
