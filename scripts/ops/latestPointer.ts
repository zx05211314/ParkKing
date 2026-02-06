import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface LatestPointer {
  datasetHash: string
  publishedAt: string
  manifestPath: string
  schemaVersion: number
}

const DEFAULT_LATEST_NAME = 'LATEST'

export const resolveLatestName = (value?: string | null) => {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : DEFAULT_LATEST_NAME
}

export const latestPointerFileName = (latestName?: string | null) => {
  const resolved = resolveLatestName(latestName)
  return /\.json$/i.test(resolved) ? resolved : `${resolved}.json`
}

export const buildLatestPointer = (params: {
  datasetHash: string
  publishedAt: string
  manifestPath: string
  schemaVersion: number
}): LatestPointer => {
  return {
    datasetHash: params.datasetHash,
    publishedAt: params.publishedAt,
    manifestPath: params.manifestPath,
    schemaVersion: params.schemaVersion,
  }
}

export const writeLatestPointer = async (
  baseDir: string,
  districtId: string,
  pointer: LatestPointer,
  latestName?: string | null,
) => {
  const normalizedManifest =
    pointer.manifestPath && path.isAbsolute(pointer.manifestPath)
      ? path.relative(baseDir, pointer.manifestPath).replace(/\\/g, '/')
      : pointer.manifestPath
  const normalizedPointer = {
    ...pointer,
    manifestPath: normalizedManifest,
  }
  const dirPath = path.resolve(baseDir, districtId)
  await fs.mkdir(dirPath, { recursive: true })
  const pointerFile = latestPointerFileName(
    latestName ?? process.env.PARKKING_LATEST_NAME ?? DEFAULT_LATEST_NAME,
  )
  const targetPath = path.resolve(dirPath, pointerFile)
  const tmpPath = path.resolve(
    dirPath,
    `${pointerFile}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  await fs.writeFile(
    tmpPath,
    `${JSON.stringify(normalizedPointer, null, 2)}\n`,
    'utf-8',
  )

  try {
    await fs.rename(targetPath, `${targetPath}.bak`)
  } catch {
    // ignore if missing
  }

  await fs.rename(tmpPath, targetPath)

  try {
    await fs.rm(`${targetPath}.bak`, { force: true })
  } catch {
    // ignore cleanup errors
  }
  return targetPath
}
