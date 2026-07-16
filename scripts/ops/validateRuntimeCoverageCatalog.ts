import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseRuntimeCoverageCatalog,
  type RuntimeCoverageCatalog,
} from '../../src/data/coverageCatalog'
import type { CoverageManifest } from './coverageStatus'

const DEFAULT_MANIFEST = 'configs/coverage.expansion.json'
const DEFAULT_CATALOG = 'public/data/coverage.json'

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
            .map(({ areaId, areaName }) => ({ areaId, areaName })),
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
  console.log(
    `Runtime coverage catalog: ${result.valid ? 'PASS' : 'FAIL'} (${result.districtCount} districts)`,
  )
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
