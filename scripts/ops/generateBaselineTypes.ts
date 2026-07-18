export interface RegistryEntry {
  districtId: string
  districtName: string
  generatedAt: string
  datasetHash: string
  schemaVersion: number
  metaSha256?: string
}

export interface GenerateBaselinesArgs {
  force: boolean
  seed: boolean
  districtIdFilter: string | null
  generatedRoot: string
}
