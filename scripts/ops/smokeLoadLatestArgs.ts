import type {
  SmokeLoadLatestCliArgs,
  SmokeLoadLatestOptions,
} from './smokeLoadLatestTypes'

export const parseSmokeLoadLatestArgs = (
  argv: string[],
): SmokeLoadLatestCliArgs => {
  const args = [...argv]
  const expectedIndex = args.findIndex((arg) => arg === '--expected')
  const rootIndex = args.findIndex((arg) => arg === '--datasetRoot')
  const latestNameIndex = args.findIndex((arg) => arg === '--latestName')
  return {
    expectedCsv: expectedIndex >= 0 ? args[expectedIndex + 1] ?? null : null,
    datasetRoot: rootIndex >= 0 ? args[rootIndex + 1] ?? null : null,
    latestName: latestNameIndex >= 0 ? args[latestNameIndex + 1] ?? null : null,
  }
}

export const resolveSmokeLoadLatestName = (value?: string | null) => {
  const normalized = value?.trim()
  if (normalized && normalized.length > 0) {
    return normalized
  }
  const fromEnv = process.env.PARKKING_LATEST_NAME?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'LATEST'
}

export const smokeLoadLatestPointerFileName = (latestName: string) => {
  return /\.json$/i.test(latestName) ? latestName : `${latestName}.json`
}

export const parseExpectedDistrictsCsv = (value: string | null) => {
  if (!value) {
    return []
  }
  const seen = new Set<string>()
  const expected: string[] = []
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      if (seen.has(entry)) {
        return
      }
      seen.add(entry)
      expected.push(entry)
    })
  return expected
}

export const normalizeSmokeLoadLatestOptions = (
  options: SmokeLoadLatestOptions,
) => {
  return {
    datasetRoot: options.datasetRoot,
    expectedDistricts: (options.expectedDistricts ?? []).filter(
      (districtId) => districtId.trim().length > 0,
    ),
    latestName: resolveSmokeLoadLatestName(options.latestName),
  }
}
