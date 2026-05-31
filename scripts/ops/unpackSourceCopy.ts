import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import AdmZip from 'adm-zip'
import type { ZipEntryInfo } from './unpackSourceTypes'
import { ALL_CANONICAL_COMPANION_EXTENSIONS } from './unpackSourceZip'

export const extractZipToDirectory = async (zipPath: string, outputDir: string) => {
  const zip = new AdmZip(zipPath)
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })
  zip.extractAllTo(outputDir, true)
}

export const copyCanonicalFiles = async (params: {
  outputDir: string
  canonicalBaseName: string
  chosenShp: ZipEntryInfo
  requiredCompanions: ZipEntryInfo[]
  optionalCompanions: ZipEntryInfo[]
}) => {
  const sourceEntries = [
    params.chosenShp,
    ...params.requiredCompanions,
    ...params.optionalCompanions,
  ]
  const sourceByExt = new Map<string, ZipEntryInfo>()
  sourceEntries.forEach((entry) => {
    const ext = path.extname(entry.normalizedPath).toLowerCase()
    sourceByExt.set(ext, entry)
  })

  const canonicalPaths: string[] = []
  for (const extension of ALL_CANONICAL_COMPANION_EXTENSIONS) {
    const source = sourceByExt.get(extension)
    if (!source) {
      continue
    }
    const sourcePath = path.resolve(params.outputDir, source.normalizedPath)
    const canonicalPath = path.resolve(
      params.outputDir,
      `${params.canonicalBaseName}${extension}`,
    )
    if (sourcePath !== canonicalPath) {
      await fs.copyFile(sourcePath, canonicalPath)
    }
    canonicalPaths.push(canonicalPath)
  }

  return {
    canonicalPaths,
    canonicalShpPath: path.resolve(params.outputDir, `${params.canonicalBaseName}.shp`),
  }
}
