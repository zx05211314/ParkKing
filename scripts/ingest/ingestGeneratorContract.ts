import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashString } from './readConfigSourceFiles'

export const GENERATOR_CONTRACT_SCHEMA_VERSION = 1

const GENERATOR_ENTRY_FILES = [
  'scripts/ingest/ingestDistrictBounds.ts',
  'scripts/ingest/ingestRedYellow.ts',
  'scripts/ingest/ingestBusStops.ts',
  'scripts/ingest/ingestHydrants.ts',
  'scripts/ingest/ingestParkingSpaces.ts',
  'scripts/ingest/ingestCrosswalks.ts',
  'scripts/ingest/ingestIntersections.ts',
  'scripts/ingest/ingestInferredCandidates.ts',
  'scripts/ingest/ingestSignOverrides.ts',
]

const GENERATOR_DEPENDENCY_FILES = ['package-lock.json']

const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/gu

const normalizeContent = (value: string) => value.replace(/\r\n?/g, '\n')

const isInsideRoot = (rootDir: string, filePath: string) => {
  const relative = path.relative(rootDir, filePath)
  return relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const resolveLocalImport = async (sourcePath: string, specifier: string) => {
  const unresolved = path.resolve(path.dirname(sourcePath), specifier)
  const extension = path.extname(unresolved)
  const candidates = extension
    ? [unresolved, extension === '.js' ? `${unresolved.slice(0, -3)}.ts` : '']
    : [
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        path.join(unresolved, 'index.ts'),
        path.join(unresolved, 'index.tsx'),
      ]

  for (const candidate of candidates.filter(Boolean)) {
    try {
      if ((await fs.stat(candidate)).isFile()) {
        return candidate
      }
    } catch {
      continue
    }
  }
  throw new Error(`Unable to resolve generator import ${specifier} from ${sourcePath}`)
}

const collectImportedFiles = async (rootDir: string, entryFiles: string[]) => {
  const pending = entryFiles.map((fileName) => path.resolve(rootDir, fileName))
  const visited = new Set<string>()

  while (pending.length > 0) {
    const filePath = pending.pop()
    if (!filePath || visited.has(filePath)) {
      continue
    }
    if (!isInsideRoot(rootDir, filePath)) {
      throw new Error(`Generator contract import escapes repository root: ${filePath}`)
    }
    const raw = await fs.readFile(filePath, 'utf-8')
    visited.add(filePath)

    for (const match of raw.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1]
      if (specifier) {
        pending.push(await resolveLocalImport(filePath, specifier))
      }
    }
  }

  return Array.from(visited)
}

export const buildGeneratorContractHash = async (options?: {
  rootDir?: string
  entryFiles?: string[]
  dependencyFiles?: string[]
}) => {
  const rootDir = path.resolve(
    options?.rootDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  )
  const importedFiles = await collectImportedFiles(
    rootDir,
    options?.entryFiles ?? GENERATOR_ENTRY_FILES,
  )
  const dependencyFiles = (options?.dependencyFiles ?? GENERATOR_DEPENDENCY_FILES).map(
    (fileName) => path.resolve(rootDir, fileName),
  )
  const files = [...new Set([...importedFiles, ...dependencyFiles])]
  const entries = await Promise.all(
    files.map(async (filePath) => ({
      path: path.relative(rootDir, filePath).replaceAll(path.sep, '/'),
      sha256: hashString(normalizeContent(await fs.readFile(filePath, 'utf-8'))),
    })),
  )
  entries.sort((left, right) => left.path.localeCompare(right.path))

  return hashString(
    JSON.stringify({
      schemaVersion: GENERATOR_CONTRACT_SCHEMA_VERSION,
      files: entries,
    }),
  )
}

let generatorContractHashPromise: Promise<string> | null = null

export const readGeneratorContractHash = () => {
  generatorContractHashPromise ??= buildGeneratorContractHash()
  return generatorContractHashPromise
}
