export interface SmokeLoadLatestCliArgs {
  expectedCsv: string | null
  datasetRoot: string | null
  latestName: string | null
}

export interface SmokeLoadLatestOptions {
  datasetRoot?: string
  expectedDistricts?: string[]
  latestName?: string
}

export interface SmokeLoadLatestRegistryEntry {
  districtId?: string
}

export interface SmokeLoadLatestRegistry {
  districts?: SmokeLoadLatestRegistryEntry[]
}
