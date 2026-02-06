import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

interface SourceEntry {
  url?: string
  dest: string
  sha256?: string
  notes?: string
}

interface DistrictSourceManifest {
  districtId?: string
  configPath?: string
  sources?: SourceEntry[]
}

interface SourceManifest extends DistrictSourceManifest {
  districts?: DistrictSourceManifest[]
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const manifestIndex = args.findIndex((arg) => arg === '--manifest')
  return {
    manifestPath: manifestIndex >= 0 ? args[manifestIndex + 1] : null,
    dryRun: args.includes('--dryRun'),
  }
}

const readManifest = async (manifestPath: string): Promise<SourceManifest> => {
  const raw = await fs.readFile(manifestPath, 'utf-8')
  return JSON.parse(raw) as SourceManifest
}

const sha256 = (buffer: Buffer) => {
  return createHash('sha256').update(buffer).digest('hex')
}

const normalizePath = (value: string) => value.replace(/\\/g, '/')

const resolveConfigPath = async (
  manifest: DistrictSourceManifest,
  manifestDir: string,
  districtId?: string | null,
) => {
  if (manifest.configPath) {
    const candidate = path.isAbsolute(manifest.configPath)
      ? manifest.configPath
      : path.resolve(manifestDir, manifest.configPath)
    return candidate
  }
  if (!districtId) {
    return null
  }
  const candidates = [
    path.resolve(process.cwd(), 'configs', 'prod', `${districtId}.json`),
    path.resolve(process.cwd(), 'configs', `${districtId}.json`),
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

const inferDistrictIdFromDest = (destPath: string) => {
  const normalized = normalizePath(destPath)
  const match = normalized.match(/data\/(?:raw|sources)\/([^/]+)\//)
  if (match && match[1]) {
    return match[1]
  }
  return null
}

const resolveDistrictId = (manifest: DistrictSourceManifest, destPaths: string[]) => {
  if (manifest.districtId) {
    return manifest.districtId
  }
  const candidates = new Set<string>()
  destPaths.forEach((dest) => {
    const inferred = inferDistrictIdFromDest(dest)
    if (inferred) {
      candidates.add(inferred)
    }
  })
  if (candidates.size === 1) {
    return [...candidates][0]
  }
  return null
}

const listDistrictManifests = (
  manifest: SourceManifest,
): DistrictSourceManifest[] => {
  if (Array.isArray(manifest.districts) && manifest.districts.length > 0) {
    return manifest.districts
  }
  return [manifest]
}

interface ProvenanceFileEntry {
  relativePath: string
  sizeBytes: number
  sha256: string
  sourceUrl?: string
}

interface ProvenanceManifest {
  schemaVersion: number
  districtId: string
  fetchedAt: string
  configHash: string
  files: ProvenanceFileEntry[]
}

const PROVENANCE_SCHEMA_VERSION = 1

const buildProvenance = (params: {
  districtId: string
  fetchedAt: string
  configHash: string
  files: ProvenanceFileEntry[]
}): ProvenanceManifest => {
  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    districtId: params.districtId,
    fetchedAt: params.fetchedAt,
    configHash: params.configHash,
    files: [...params.files].sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
  }
}

const validateProvenance = (payload: ProvenanceManifest) => {
  if (payload.schemaVersion !== PROVENANCE_SCHEMA_VERSION) {
    throw new Error(`Unsupported provenance schemaVersion ${payload.schemaVersion}`)
  }
  if (!payload.districtId) {
    throw new Error('Provenance districtId is required')
  }
  if (!payload.configHash) {
    throw new Error('Provenance configHash is required')
  }
  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    throw new Error('Provenance files list is required')
  }
}

const fetchBuffer = async (url: string): Promise<Buffer> => {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Use Node 18+ or add a fetch polyfill.')
  }
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export const fetchSources = async (params: {
  manifestPath: string
  dryRun?: boolean
  provenanceRoot?: string
}) => {
  const manifestPath = path.resolve(params.manifestPath)
  const manifestDir = path.dirname(manifestPath)
  const manifest = await readManifest(manifestPath)
  const provenanceRoot = params.provenanceRoot ?? process.cwd()
  const districtManifests = listDistrictManifests(manifest)
  let hasSources = false

  for (const districtManifest of districtManifests) {
    const sources = districtManifest.sources ?? []
    if (sources.length === 0) {
      continue
    }
    hasSources = true

    const resolvedDestinations = sources.map((source) =>
      path.isAbsolute(source.dest) ? source.dest : path.resolve(manifestDir, source.dest),
    )
    const districtId = resolveDistrictId(districtManifest, resolvedDestinations)
    const configPath = await resolveConfigPath(districtManifest, manifestDir, districtId)
    if (!districtId || !configPath) {
      throw new Error(
        'Unable to resolve districtId/configPath. Provide districtId or configPath in manifest.',
      )
    }

    const configRaw = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(configRaw) as { districtId?: string }
    const configDistrictId = config.districtId ?? districtId
    const configHash = sha256(Buffer.from(configRaw))
    const fileEntries: ProvenanceFileEntry[] = []

    for (const source of sources) {
      if (!source.url || !source.dest) {
        throw new Error('Each source must include url and dest.')
      }
      const destPath = path.isAbsolute(source.dest)
        ? source.dest
        : path.resolve(manifestDir, source.dest)

      const buffer = await fetchBuffer(source.url)
      const digest = sha256(buffer)

      if (source.sha256 && source.sha256 !== digest) {
        throw new Error(
          `Checksum mismatch for ${source.url}: expected ${source.sha256}, got ${digest}`,
        )
      }

      if (params.dryRun) {
        console.log(`[dryRun] ${source.url} -> ${destPath} (${buffer.length} bytes)`)
        continue
      }

      await fs.mkdir(path.dirname(destPath), { recursive: true })
      await fs.writeFile(destPath, buffer)
      fileEntries.push({
        relativePath: normalizePath(path.relative(provenanceRoot, destPath)),
        sizeBytes: buffer.length,
        sha256: digest,
        sourceUrl: source.url,
      })
      console.log(`Fetched ${source.url} -> ${destPath}`)
    }

    if (params.dryRun) {
      continue
    }

    const provenance = buildProvenance({
      districtId: configDistrictId,
      fetchedAt: new Date().toISOString(),
      configHash,
      files: fileEntries,
    })
    validateProvenance(provenance)
    const provenanceDir = path.resolve(provenanceRoot, 'data', 'sources', configDistrictId)
    await fs.mkdir(provenanceDir, { recursive: true })
    const provenancePath = path.resolve(provenanceDir, 'provenance.json')
    await fs.writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf-8')
  }

  if (!hasSources) {
    console.log('No sources defined in manifest.')
  }
}

const run = async () => {
  const args = parseArgs(process.argv)
  const manifestPath = args.manifestPath ?? 'ops/sources.json'
  await fetchSources({ manifestPath, dryRun: args.dryRun })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
