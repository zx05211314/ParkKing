import { createReadStream, createWriteStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'
import { createGzip } from 'node:zlib'

const DEFAULT_ROOT_DIR = 'dist/data/generated'
const DEFAULT_MIN_BYTES = 1_024
const COMPRESSIBLE_EXTENSIONS = new Set(['.geojson', '.json', '.jsonl'])

export interface PrecompressStaticDataOptions {
  rootDir?: string
  minBytes?: number
}

export interface PrecompressStaticDataResult {
  rootDir: string
  scannedFiles: number
  compressedFiles: number
  sourceBytes: number
  compressedBytes: number
  skippedFiles: number
}

const listFiles = async (rootDir: string): Promise<string[]> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    }),
  )
  return nested.flat().sort((left, right) => left.localeCompare(right))
}

export const shouldPrecompressStaticFile = (
  filePath: string,
  size: number,
  minBytes = DEFAULT_MIN_BYTES,
) =>
  size >= minBytes && COMPRESSIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())

const writeGzipSidecar = async (sourcePath: string) => {
  const targetPath = `${sourcePath}.gz`
  const temporaryPath = `${targetPath}.tmp`
  await pipeline(
    createReadStream(sourcePath),
    createGzip({ level: 9 }),
    createWriteStream(temporaryPath),
  )
  const compressedStat = await fs.stat(temporaryPath)
  const sourceStat = await fs.stat(sourcePath)
  if (compressedStat.size >= sourceStat.size) {
    await fs.rm(temporaryPath, { force: true })
    await fs.rm(targetPath, { force: true })
    return null
  }
  await fs.rm(targetPath, { force: true })
  await fs.rename(temporaryPath, targetPath)
  return compressedStat.size
}

export const precompressStaticData = async (
  options: PrecompressStaticDataOptions = {},
): Promise<PrecompressStaticDataResult> => {
  const rootDir = path.resolve(options.rootDir ?? DEFAULT_ROOT_DIR)
  const minBytes = options.minBytes ?? DEFAULT_MIN_BYTES
  const files = (await listFiles(rootDir)).filter(
    (filePath) => !filePath.endsWith('.gz') && !filePath.endsWith('.gz.tmp'),
  )

  let compressedFiles = 0
  let sourceBytes = 0
  let compressedBytes = 0
  for (const filePath of files) {
    const stat = await fs.stat(filePath)
    if (!shouldPrecompressStaticFile(filePath, stat.size, minBytes)) {
      continue
    }
    const compressedSize = await writeGzipSidecar(filePath)
    if (compressedSize === null) {
      continue
    }
    compressedFiles += 1
    sourceBytes += stat.size
    compressedBytes += compressedSize
  }

  return {
    rootDir,
    scannedFiles: files.length,
    compressedFiles,
    sourceBytes,
    compressedBytes,
    skippedFiles: files.length - compressedFiles,
  }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
}

const parsePositiveInteger = (value: string | undefined, label: string) => {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

const renderResult = (result: PrecompressStaticDataResult) => {
  const savedBytes = result.sourceBytes - result.compressedBytes
  const reduction = result.sourceBytes > 0
    ? ((savedBytes / result.sourceBytes) * 100).toFixed(1)
    : '0.0'
  return [
    '# Precompress Static Data: PASS',
    `- Root: ${result.rootDir}`,
    `- Files: ${result.compressedFiles}/${result.scannedFiles} compressed`,
    `- Source bytes: ${result.sourceBytes}`,
    `- Compressed bytes: ${result.compressedBytes}`,
    `- Reduction: ${reduction}%`,
  ].join('\n')
}

const isMainModule = () => {
  const entry = process.argv[1]
  return entry ? pathToFileURL(entry).href === import.meta.url : false
}

if (isMainModule()) {
  precompressStaticData({
    rootDir: getArgValue(process.argv, '--root'),
    minBytes: parsePositiveInteger(
      getArgValue(process.argv, '--min-bytes'),
      '--min-bytes',
    ),
  })
    .then((result) => console.log(renderResult(result)))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
