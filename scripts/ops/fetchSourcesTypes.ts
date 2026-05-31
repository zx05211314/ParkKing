export interface SourceEntry {
  url?: string
  dest: string
  sha256?: string
  notes?: string
}

export interface DistrictSourceManifest {
  districtId?: string
  configPath?: string
  sources?: SourceEntry[]
}

export interface SourceManifest extends DistrictSourceManifest {
  districts?: DistrictSourceManifest[]
}

export interface FetchSourcesArgs {
  manifestPath: string | null
  dryRun: boolean
}

export interface FetchSourcesParams {
  manifestPath: string
  dryRun?: boolean
  provenanceRoot?: string
}

export interface ProvenanceFileEntry {
  relativePath: string
  sizeBytes: number
  sha256: string
  sourceUrl?: string
}

export interface ProvenanceManifest {
  schemaVersion: number
  districtId: string
  fetchedAt: string
  configHash: string
  files: ProvenanceFileEntry[]
}
