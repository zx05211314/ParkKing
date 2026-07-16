import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'
import type { ResolvedConfig, SourceFileMeta } from './readConfigTypes'

export const hashString = (value: string) => {
  return crypto.createHash('sha256').update(value).digest('hex')
}

const TEXT_EXTENSIONS = new Set([
  '.csv',
  '.geojson',
  '.json',
  '.jsonl',
  '.txt',
])

const SHAPEFILE_EXTENSIONS = new Set(['.cpg', '.dbf', '.prj', '.shp', '.shx'])

const normalizeTextContent = (buffer: Buffer) =>
  buffer.toString('utf-8').replace(/\r\n?/g, '\n')

const hashFileContent = async (filePath: string) => {
  const buffer = await fs.readFile(filePath)
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
    ? hashString(normalizeTextContent(buffer))
    : crypto.createHash('sha256').update(buffer).digest('hex')
}

const fileExists = async (filePath: string) => {
  try {
    return (await fs.stat(filePath)).isFile()
  } catch {
    return false
  }
}

const resolveShapefileArchive = (filePath: string) => {
  const sourceDir = path.dirname(filePath)
  return path.join(
    path.dirname(sourceDir),
    `${path.basename(sourceDir)}.zip`,
  )
}

const hashShapefileFamily = async (filePath: string) => {
  const sourceDir = path.dirname(filePath)
  const sourceBase = path.basename(filePath, path.extname(filePath)).toLowerCase()
  const fileNames = (await fs.readdir(sourceDir))
    .filter((fileName) => {
      const extension = path.extname(fileName).toLowerCase()
      return (
        SHAPEFILE_EXTENSIONS.has(extension) &&
        path.basename(fileName, extension).toLowerCase() === sourceBase
      )
    })
    .sort((left, right) => left.localeCompare(right))
  const hash = crypto.createHash('sha256')
  for (const fileName of fileNames) {
    hash.update(fileName.toLowerCase())
    hash.update('\0')
    hash.update(await fs.readFile(path.join(sourceDir, fileName)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export const hashSourceContent = async (filePath: string) => {
  if (path.extname(filePath).toLowerCase() !== '.shp') {
    return await hashFileContent(filePath)
  }
  const archivePath = resolveShapefileArchive(filePath)
  return (await fileExists(archivePath))
    ? await hashFileContent(archivePath)
    : await hashShapefileFamily(filePath)
}

const collectSourceFile = async (
  sourceKey: string,
  filePath: string,
): Promise<SourceFileMeta> => {
  const stat = await fs.stat(filePath)
  return {
    path: filePath,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    sourceKey,
    contentHash: await hashSourceContent(filePath),
  }
}

export const collectSourceFiles = async (
  inputs: ResolvedConfig['inputs'],
  optionalFilePaths: string[] = [],
): Promise<SourceFileMeta[]> => {
  const sourceFiles: SourceFileMeta[] = []
  for (const [key, filePath] of Object.entries(inputs)) {
    if (!filePath) {
      continue
    }
    if (!(await fileExists(filePath))) {
      throw new Error(`Input file not found for ${key}: ${filePath}`)
    }
    sourceFiles.push(await collectSourceFile(key, filePath))
  }
  for (const filePath of optionalFilePaths) {
    if (!(await fileExists(filePath))) {
      continue
    }
    sourceFiles.push(
      await collectSourceFile(
        `optional:${path.basename(filePath).toLowerCase()}`,
        filePath,
      ),
    )
  }
  return sourceFiles
}

export const buildConfigHashes = (raw: string, sourceFiles: SourceFileMeta[]) => {
  const configHash = hashString(raw.replace(/\r\n?/g, '\n'))
  const stableSourceFiles = sourceFiles
    .map((sourceFile, index) => ({
      sourceKey:
        sourceFile.sourceKey ??
        `legacy:${index}:${path.basename(sourceFile.path).toLowerCase()}`,
      contentHash:
        sourceFile.contentHash ??
        hashString(
          JSON.stringify({
            size: sourceFile.size,
            mtimeMs: Math.round(sourceFile.mtimeMs),
          }),
        ),
    }))
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey))
  const datasetSourceHash = hashString(
    JSON.stringify({ configHash, sourceFiles: stableSourceFiles }),
  )
  return { configHash, datasetSourceHash }
}
