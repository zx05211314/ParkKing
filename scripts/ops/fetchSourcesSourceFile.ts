import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { normalizeFetchSourcesPath } from './fetchSourcesManifest'
import { hashBufferSha256 } from './fetchSourcesProvenance'
import { fetchSourceBuffer } from './fetchSourcesTransport'
import type { ProvenanceFileEntry, SourceEntry } from './fetchSourcesTypes'

export const fetchSourceFile = async (params: {
  source: SourceEntry
  manifestDir: string
  provenanceRoot: string
  dryRun: boolean
}): Promise<ProvenanceFileEntry | null> => {
  if (!params.source.url || !params.source.dest) {
    throw new Error('Each source must include url and dest.')
  }

  const destPath = path.isAbsolute(params.source.dest)
    ? params.source.dest
    : path.resolve(params.manifestDir, params.source.dest)

  const buffer = await fetchSourceBuffer(params.source.url)
  const digest = hashBufferSha256(buffer)

  if (params.source.sha256 && params.source.sha256 !== digest) {
    throw new Error(
      `Checksum mismatch for ${params.source.url}: expected ${params.source.sha256}, got ${digest}`,
    )
  }

  if (params.dryRun) {
    console.log(`[dryRun] ${params.source.url} -> ${destPath} (${buffer.length} bytes)`)
    return null
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true })
  await fs.writeFile(destPath, buffer)
  console.log(`Fetched ${params.source.url} -> ${destPath}`)

  return {
    relativePath: normalizeFetchSourcesPath(path.relative(params.provenanceRoot, destPath)),
    sizeBytes: buffer.length,
    sha256: digest,
    sourceUrl: params.source.url,
  }
}
