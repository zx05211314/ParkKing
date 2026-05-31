import { fileURLToPath } from 'node:url'

import {
  normalizeSmokeLoadLatestOptions,
  parseSmokeLoadLatestArgs,
  parseExpectedDistrictsCsv,
  smokeLoadLatestPointerFileName,
} from './smokeLoadLatestArgs'
import { resolveSmokeLoadLatestDatasetRoot } from './smokeLoadLatestFiles'
import { verifySmokeLoadLatestDistricts } from './smokeLoadLatestDistricts'
import { loadSmokeLoadLatestRegistry } from './smokeLoadLatestRegistry'
import type { SmokeLoadLatestOptions } from './smokeLoadLatestTypes'

export const runSmokeLoadLatest = async (options: SmokeLoadLatestOptions = {}) => {
  const normalized = normalizeSmokeLoadLatestOptions(options)
  const baseDir = resolveSmokeLoadLatestDatasetRoot(normalized.datasetRoot)
  const pointerFileName = smokeLoadLatestPointerFileName(normalized.latestName)
  const districts = await loadSmokeLoadLatestRegistry({
    baseDir,
    expectedDistricts: normalized.expectedDistricts,
  })
  await verifySmokeLoadLatestDistricts({
    baseDir,
    districts,
    pointerFileName,
  })

  console.log(`Smoke load ok: ${districts.length} districts`)
}

const run = async () => {
  const args = parseSmokeLoadLatestArgs(process.argv)
  await runSmokeLoadLatest({
    datasetRoot: args.datasetRoot ?? undefined,
    expectedDistricts: parseExpectedDistrictsCsv(args.expectedCsv),
    latestName: args.latestName ?? undefined,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
