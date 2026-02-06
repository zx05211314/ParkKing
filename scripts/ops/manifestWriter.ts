import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export type GateResult = 'PASS' | 'WARN' | 'OVERRIDE' | 'FAIL' | 'ROLLBACK'

export interface PublishManifest {
  districtId: string
  districtName: string
  schemaVersion: number
  datasetHash: string
  configHash: string
  generatedAt: string
  publishedAt: string
  metaSha256: string
  packSha256: string
  totalBytes: number
  files: Record<string, { sha256: string; bytes: number }>
  provenance?: { path: string; sha256: string; bytes: number }
  diffReport?: { path: string; sha256: string; bytes: number }
  metricsHistory?: { path: string; sha256: string; bytes: number }
  gateResult: GateResult
  overrideReason?: string | null
  baselines?: {
    baselineDatasetHash?: string
    baselineCreatedAt?: string
  }
  toolVersions: {
    node: string
    packageVersion?: string
  }
}

export const buildManifestFileName = (publishedAt: string, datasetHash: string) => {
  const safeTimestamp = publishedAt.replace(/[:.]/g, '')
  return `${safeTimestamp}_${datasetHash}.json`
}

const readPackageVersion = async () => {
  try {
    const raw = await fs.readFile(path.resolve('package.json'), 'utf-8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version
  } catch {
    return undefined
  }
}

export const writePublishManifest = async (params: {
  baseDir: string
  manifest: PublishManifest
}): Promise<string> => {
  const fileName = buildManifestFileName(
    params.manifest.publishedAt,
    params.manifest.datasetHash,
  )
  const targetDir = path.resolve(
    params.baseDir,
    '_ops',
    'manifests',
    params.manifest.districtId,
  )
  await fs.mkdir(targetDir, { recursive: true })

  const packageVersion = await readPackageVersion()
  const manifest: PublishManifest = {
    ...params.manifest,
    toolVersions: {
      node: process.version,
      packageVersion,
    },
  }

  const targetPath = path.resolve(targetDir, fileName)
  await fs.writeFile(targetPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  return targetPath
}
