import AdmZip from 'adm-zip'
import type { ZipEntryInfo } from './unpackSourceTypes'
import { hasZipExt, normalizeZipPath } from './unpackSourceZipPath'

export const listZipEntries = (zipPath: string): ZipEntryInfo[] => {
  const zip = new AdmZip(zipPath)
  return zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      entryName: entry.entryName,
      normalizedPath: normalizeZipPath(entry.entryName),
      size: entry.header.size,
    }))
}

export const chooseMainShpEntry = (entries: ZipEntryInfo[]) => {
  const shpEntries = entries.filter((entry) => hasZipExt(entry.normalizedPath, '.shp'))
  if (shpEntries.length === 0) {
    return null
  }
  return [...shpEntries].sort((a, b) => {
    if (b.size !== a.size) {
      return b.size - a.size
    }
    return a.normalizedPath.localeCompare(b.normalizedPath)
  })[0]
}
