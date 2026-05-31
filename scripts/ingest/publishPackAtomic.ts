import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { computePackSha256 } from '../ops/registryUtils'
import { diffPacks } from '../ops/diffPacks'
import { writeMetricsHistory } from '../ops/writeMetricsHistory'

export interface PublishResult {
  publishedAt: string
  stageDir: string
  destDir: string
  backupDir: string | null
  metaSha256: string
  packSha256: string
  totalBytes: number
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

type DatasetMetaForPublish = Record<string, unknown> & {
  files?: Record<string, { sha256: string }>
  totalBytes?: number
}

export const publishPackAtomic = async (params: {
  sourceDir: string
  destDir: string
  dryRun?: boolean
  hooks?: {
    beforeSwap?: () => void | Promise<void>
    afterSwap?: () => void | Promise<void>
  }
}): Promise<PublishResult> => {
  const { sourceDir, destDir } = params
  const metaPath = path.resolve(sourceDir, 'dataset_meta.json')
  const meta = await readJson<DatasetMetaForPublish>(metaPath)
  const datasetHash = (meta.datasetHash as string) ?? 'unknown'

  const publishedAt = new Date().toISOString()
  const updatedMeta = {
    ...meta,
    publishedAt,
    publishMode: 'atomic',
  }
  const updatedMetaRaw = `${JSON.stringify(updatedMeta, null, 2)}\n`
  const metaSha256 = crypto.createHash('sha256').update(updatedMetaRaw).digest('hex')
  const files = meta.files
  const packSha256 = files ? computePackSha256(files) : ''
  const totalBytes = Number(meta.totalBytes ?? 0)

  const baseDir = path.dirname(destDir)
  const districtId = path.basename(destDir)
  const stagingDir = path.resolve(baseDir, '.staging', `${districtId}-${datasetHash}`)
  const backupBase = path.resolve(baseDir, '.backup')

  if (params.dryRun) {
    return {
      publishedAt,
      stageDir: stagingDir,
      destDir,
      backupDir: null,
      metaSha256,
      packSha256,
      totalBytes,
    }
  }

  await fs.rm(stagingDir, { recursive: true, force: true })
  await fs.mkdir(stagingDir, { recursive: true })
  await fs.cp(sourceDir, stagingDir, { recursive: true })
  await fs.writeFile(path.resolve(stagingDir, 'dataset_meta.json'), updatedMetaRaw, 'utf-8')

  try {
    const existing = await fs.readdir(destDir, { withFileTypes: true })
    const pointerFiles = existing
      .filter((entry) => entry.isFile() && /^LATEST.*\.json$/i.test(entry.name))
      .map((entry) => entry.name)
    for (const fileName of pointerFiles) {
      await fs.copyFile(
        path.resolve(destDir, fileName),
        path.resolve(stagingDir, fileName),
      )
    }
  } catch {
    // ignore if destination missing
  }

  let prevDir: string | null = null
  try {
    await fs.access(path.resolve(destDir, 'dataset_meta.json'))
    prevDir = destDir
  } catch {
    prevDir = null
  }

  try {
    await diffPacks({
      prevDir,
      nextDir: stagingDir,
      outPath: path.resolve(stagingDir, 'diff_report.json'),
    })
  } catch (error) {
    console.warn('Diff report generation failed:', error)
  }

  try {
    await writeMetricsHistory({
      packDir: stagingDir,
      prevPackDir: prevDir,
    })
  } catch (error) {
    console.warn('Metrics history generation failed:', error)
  }

  if (params.hooks?.beforeSwap) {
    await params.hooks.beforeSwap()
  }

  let backupDir: string | null = null
  try {
    const destStat = await fs.stat(destDir)
    if (destStat.isDirectory()) {
      let oldHash = 'unknown'
      try {
        const existingMeta = await readJson<Record<string, unknown>>(
          path.resolve(destDir, 'dataset_meta.json'),
        )
        oldHash = (existingMeta.datasetHash as string) ?? oldHash
      } catch {
        oldHash = 'unknown'
      }
      const timestamp = publishedAt.replace(/[:.]/g, '')
      backupDir = path.resolve(
        backupBase,
        `${districtId}-${timestamp}-${oldHash}`,
      )
      await fs.mkdir(backupBase, { recursive: true })
      await fs.rename(destDir, backupDir)
    }
  } catch {
    backupDir = null
  }

  await fs.rename(stagingDir, destDir)

  if (params.hooks?.afterSwap) {
    await params.hooks.afterSwap()
  }

  return {
    publishedAt,
    stageDir: stagingDir,
    destDir,
    backupDir,
    metaSha256,
    packSha256,
    totalBytes,
  }
}

const run = async () => {
  const sourceDir = process.argv[2]
  const destDir = process.argv[3]
  const dryRun = process.argv.includes('--dryRun')
  if (!sourceDir || !destDir) {
    throw new Error('Usage: tsx publishPackAtomic.ts <sourceDir> <destDir>')
  }
  await publishPackAtomic({ sourceDir, destDir, dryRun })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
