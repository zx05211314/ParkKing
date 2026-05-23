export interface ZipEntryInfo {
  entryName: string
  normalizedPath: string
  size: number
}

export interface UnpackSummary {
  archivePath: string
  outputDir: string
  chosenShpEntry: string
  canonicalShpPath: string
}
