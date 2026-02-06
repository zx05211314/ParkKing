import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'
import fg from 'fast-glob'
import { execSync } from 'node:child_process'
import AdmZip from 'adm-zip'
import { fileURLToPath } from 'node:url'

interface RegistryEntry {
  districtId: string
  latest?: {
    datasetHash: string
    publishedAt: string
  }
}

interface LatestPointer {
  datasetHash: string
  publishedAt: string
  manifestPath?: string
  schemaVersion?: number
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const outIndex = args.findIndex((arg) => arg === '--outDir')
  const includeIndex = args.findIndex((arg) => arg === '--include')
  const registryIndex = args.findIndex((arg) => arg === '--registry')
  return {
    outDir: outIndex >= 0 ? args[outIndex + 1] : null,
    include: includeIndex >= 0 ? args[includeIndex + 1] : null,
    registry: registryIndex >= 0 ? args[registryIndex + 1] : null,
  }
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const sha256 = (buffer: Buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

const timestampId = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate(),
  )}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
}

const getGitShortSha = () => {
  try {
    const stdout = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    return stdout.toString().trim()
  } catch {
    return 'nogit'
  }
}

const resolveManifestPath = (baseDir: string, manifestPath?: string) => {
  if (!manifestPath) {
    return null
  }
  const normalized = manifestPath.replace(/\\/g, '/')
  if (path.isAbsolute(normalized)) {
    return normalized
  }
  return path.resolve(baseDir, normalized)
}

export const collectReleaseFiles = async (params: {
  registryPath: string
  includeGlob: string
}) => {
  const registryPath = path.resolve(params.registryPath)
  const baseDir = path.dirname(registryPath)
  const registry = await readJson<{ districts: RegistryEntry[] }>(registryPath)

  const files = new Set<string>()
  files.add(registryPath)

  const includeMatches = await fg(params.includeGlob, { onlyFiles: true })
  includeMatches.forEach((entry) => {
    const normalized = path.resolve(entry)
    const normalizedPath = normalized.replace(/\\/g, '/')
    if (normalizedPath.includes('/.backup/') || normalizedPath.includes('/.staging/')) {
      return
    }
    files.add(normalized)
  })

  const opsReport = path.resolve(baseDir, 'ingest_all_report.json')
  const opsGate = path.resolve(baseDir, '_ops', 'publish_gate_summary.json')
  try {
    await fs.access(opsReport)
    files.add(opsReport)
  } catch {
    // ignore
  }
  try {
    await fs.access(opsGate)
    files.add(opsGate)
  } catch {
    // ignore
  }

  for (const district of registry.districts ?? []) {
    const districtDir = path.resolve(baseDir, district.districtId)
    const districtFiles = await fg(`${districtDir.replace(/\\/g, '/')}/**`, {
      onlyFiles: true,
    })
    districtFiles.forEach((entry) => files.add(path.resolve(entry)))

    const latestPath = path.resolve(districtDir, 'LATEST.json')
    let latest: LatestPointer | null = null
    try {
      latest = await readJson<LatestPointer>(latestPath)
    } catch {
      latest = null
    }

    const manifestPath = resolveManifestPath(baseDir, latest?.manifestPath)
    if (manifestPath) {
      try {
        await fs.access(manifestPath)
        files.add(manifestPath)
      } catch {
        // fall back to include all manifests
        const manifestDir = path.resolve(baseDir, '_ops', 'manifests', district.districtId)
        const manifestFiles = await fg(`${manifestDir.replace(/\\/g, '/')}/**`, {
          onlyFiles: true,
        })
        manifestFiles.forEach((entry) => files.add(path.resolve(entry)))
      }
    }
  }

  return { baseDir, files: Array.from(files) }
}

export const packageRelease = async (params: {
  outDir: string
  includeGlob: string
  registryPath: string
}) => {
  const releaseId = `${timestampId()}_${getGitShortSha()}`
  const { baseDir, files } = await collectReleaseFiles({
    registryPath: params.registryPath,
    includeGlob: params.includeGlob,
  })

  const manifestEntries: Array<{ path: string; sha256: string; bytes: number }> = []
  const zip = new AdmZip()

  for (const filePath of files) {
    const buffer = await fs.readFile(filePath)
    const rel = path.relative(baseDir, filePath).replace(/\\/g, '/')
    zip.addFile(rel, buffer)
    manifestEntries.push({
      path: rel,
      sha256: sha256(buffer),
      bytes: buffer.length,
    })
  }

  await fs.mkdir(params.outDir, { recursive: true })
  const zipPath = path.resolve(params.outDir, `park-king-data_${releaseId}.zip`)
  zip.writeZip(zipPath)

  const releaseManifest = {
    releaseId,
    generatedAt: new Date().toISOString(),
    baseDir: path.relative(process.cwd(), baseDir),
    files: manifestEntries.sort((a, b) => a.path.localeCompare(b.path)),
  }

  const manifestPath = path.resolve(
    params.outDir,
    `release_manifest_${releaseId}.json`,
  )
  await fs.writeFile(manifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, 'utf-8')

  return { zipPath, manifestPath, releaseId }
}

const run = async () => {
  const args = parseArgs(process.argv)
  const outDir = args.outDir ?? 'dist/releases'
  const includeGlob = args.include ?? 'public/data/generated/**'
  const registryPath =
    args.registry ?? 'public/data/generated/registry.json'

  await packageRelease({
    outDir,
    includeGlob,
    registryPath,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
