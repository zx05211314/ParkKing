export interface RegistryEntry {
  districtId: string
  latest?: {
    datasetHash: string
    publishedAt: string
  }
}

export interface LatestPointer {
  datasetHash: string
  publishedAt: string
  manifestPath?: string
  schemaVersion?: number
}

export interface ReleaseManifestEntry {
  path: string
  sha256: string
  bytes: number
}
