import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import AdmZip from 'adm-zip'
import type { ReleaseManifestEntry } from './packageReleaseTypes'
import { sha256Buffer } from './packageReleaseUtils'
import { relativeCompat } from './pathCompat'

export const buildReleaseManifest = (params: {
  releaseId: string
  baseDir: string
  manifestEntries: ReleaseManifestEntry[]
  cwd?: string
}) => ({
  releaseId: params.releaseId,
  generatedAt: new Date().toISOString(),
  baseDir: relativeCompat(params.cwd ?? process.cwd(), params.baseDir),
  files: [...params.manifestEntries].sort((a, b) => a.path.localeCompare(b.path)),
})

export const writeReleaseArchive = async (params: {
  outDir: string
  baseDir: string
  files: string[]
  releaseId: string
  fileContents?: Map<string, Buffer>
}) => {
  const manifestEntries: ReleaseManifestEntry[] = []
  const zip = new AdmZip()

  for (const filePath of params.files) {
    const buffer = params.fileContents?.get(filePath) ?? (await fs.readFile(filePath))
    const rel = relativeCompat(params.baseDir, filePath).replace(/\\/g, '/')
    zip.addFile(rel, buffer)
    manifestEntries.push({
      path: rel,
      sha256: sha256Buffer(buffer),
      bytes: buffer.length,
    })
  }

  await fs.mkdir(params.outDir, { recursive: true })
  const zipPath = path.resolve(params.outDir, `park-king-data_${params.releaseId}.zip`)
  zip.writeZip(zipPath)

  const releaseManifest = buildReleaseManifest({
    releaseId: params.releaseId,
    baseDir: params.baseDir,
    manifestEntries,
  })
  const manifestPath = path.resolve(
    params.outDir,
    `release_manifest_${params.releaseId}.json`,
  )
  await fs.writeFile(manifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, 'utf-8')

  return { zipPath, manifestPath, releaseManifest }
}
