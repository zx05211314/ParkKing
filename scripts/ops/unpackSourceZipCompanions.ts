import type { ZipEntryInfo } from './unpackSourceTypes'
import { stripZipExt } from './unpackSourceZipPath'

const REQUIRED_COMPANION_EXTENSIONS = ['.dbf', '.shx'] as const
const OPTIONAL_COMPANION_EXTENSIONS = ['.prj'] as const

const findEntryByPath = (entries: ZipEntryInfo[], normalizedPath: string) => {
  const target = normalizedPath.toLowerCase()
  return entries.find((entry) => entry.normalizedPath.toLowerCase() === target) ?? null
}

export const resolveCompanionEntries = (entries: ZipEntryInfo[], chosenShp: ZipEntryInfo) => {
  const shpBase = stripZipExt(chosenShp.normalizedPath)
  const required = REQUIRED_COMPANION_EXTENSIONS.map((ext) => {
    const candidate = findEntryByPath(entries, `${shpBase}${ext}`)
    if (!candidate) {
      throw new Error(
        `Missing required companion file ${ext} for ${chosenShp.normalizedPath}`,
      )
    }
    return candidate
  })
  const optional = OPTIONAL_COMPANION_EXTENSIONS.map((ext) =>
    findEntryByPath(entries, `${shpBase}${ext}`),
  ).filter((entry): entry is ZipEntryInfo => Boolean(entry))

  return {
    required,
    optional,
  }
}

export const ALL_CANONICAL_COMPANION_EXTENSIONS = [
  ...REQUIRED_COMPANION_EXTENSIONS,
  ...OPTIONAL_COMPANION_EXTENSIONS,
  '.shp',
] as const
