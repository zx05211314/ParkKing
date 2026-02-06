import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const REQUIRED_COMPANION_EXTENSIONS = ['.dbf', '.shx'] as const
const OPTIONAL_COMPANION_EXTENSIONS = ['.prj'] as const

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

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const sourceIndex = args.findIndex((arg) => arg === '--sourceDir')
  return {
    sourceDir: sourceIndex >= 0 ? args[sourceIndex + 1] : null,
  }
}

const normalizeZipPath = (value: string) => {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/, '')
  return normalized.replace(/\/+/g, '/')
}

const hasExt = (filePath: string, ext: string) =>
  filePath.toLowerCase().endsWith(ext.toLowerCase())

const stripExt = (filePath: string) => filePath.replace(/\.[^./\\]+$/u, '')

const listZipEntries = (zipPath: string): ZipEntryInfo[] => {
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
  const shpEntries = entries.filter((entry) => hasExt(entry.normalizedPath, '.shp'))
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

const findEntryByPath = (entries: ZipEntryInfo[], normalizedPath: string) => {
  const target = normalizedPath.toLowerCase()
  return entries.find((entry) => entry.normalizedPath.toLowerCase() === target) ?? null
}

const resolveCompanionEntries = (entries: ZipEntryInfo[], chosenShp: ZipEntryInfo) => {
  const shpBase = stripExt(chosenShp.normalizedPath)
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

const extractZip = async (zipPath: string, outputDir: string) => {
  const zip = new AdmZip(zipPath)
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })
  zip.extractAllTo(outputDir, true)
}

const copyCanonicalFiles = async (params: {
  outputDir: string
  canonicalBaseName: string
  chosenShp: ZipEntryInfo
  requiredCompanions: ZipEntryInfo[]
  optionalCompanions: ZipEntryInfo[]
}) => {
  const normalizedBase = stripExt(params.chosenShp.normalizedPath)
  const sourceEntries = [params.chosenShp, ...params.requiredCompanions, ...params.optionalCompanions]
  const sourceByExt = new Map<string, ZipEntryInfo>()
  sourceEntries.forEach((entry) => {
    const ext = path.extname(entry.normalizedPath).toLowerCase()
    sourceByExt.set(ext, entry)
  })

  const canonicalPaths: string[] = []
  const allExtensions = [...REQUIRED_COMPANION_EXTENSIONS, ...OPTIONAL_COMPANION_EXTENSIONS, '.shp']
  for (const extension of allExtensions) {
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
    sourceBase: normalizedBase,
    canonicalPaths,
    canonicalShpPath: path.resolve(params.outputDir, `${params.canonicalBaseName}.shp`),
  }
}

const unpackZipFile = async (params: {
  zipPath: string
  sourceRoot: string
}): Promise<UnpackSummary> => {
  const zipPath = path.resolve(params.zipPath)
  const archiveBase = path.basename(zipPath, path.extname(zipPath))
  const outputDir = path.resolve(params.sourceRoot, archiveBase)
  const entries = listZipEntries(zipPath)
  const chosenShp = chooseMainShpEntry(entries)
  if (!chosenShp) {
    throw new Error(`No .shp file found in archive ${zipPath}`)
  }

  const companions = resolveCompanionEntries(entries, chosenShp)
  await extractZip(zipPath, outputDir)
  const copied = await copyCanonicalFiles({
    outputDir,
    canonicalBaseName: archiveBase,
    chosenShp,
    requiredCompanions: companions.required,
    optionalCompanions: companions.optional,
  })

  return {
    archivePath: zipPath,
    outputDir,
    chosenShpEntry: chosenShp.normalizedPath,
    canonicalShpPath: copied.canonicalShpPath,
  }
}

const listZipFiles = async (sourceRoot: string) => {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && hasExt(entry.name, '.zip'))
    .map((entry) => path.resolve(sourceRoot, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

export const unpackSources = async (params?: { sourceDir?: string }) => {
  const sourceRoot = path.resolve(params?.sourceDir ?? 'data/sources/shared')
  const zipFiles = await listZipFiles(sourceRoot)
  if (zipFiles.length === 0) {
    console.log(`No zip files found in ${sourceRoot}`)
    return [] as UnpackSummary[]
  }

  const summaries: UnpackSummary[] = []
  for (const zipPath of zipFiles) {
    const summary = await unpackZipFile({ zipPath, sourceRoot })
    summaries.push(summary)
    console.log(`Unpacked ${path.basename(zipPath)} -> ${summary.canonicalShpPath}`)
  }
  return summaries
}

const run = async () => {
  const args = parseArgs(process.argv)
  await unpackSources({ sourceDir: args.sourceDir ?? undefined })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
