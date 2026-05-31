import { createHash } from 'node:crypto'

import type { ProvenanceFileEntry, ProvenanceManifest } from './fetchSourcesTypes'

export const PROVENANCE_SCHEMA_VERSION = 1

export const hashBufferSha256 = (buffer: Buffer) => {
  return createHash('sha256').update(buffer).digest('hex')
}

export const buildProvenanceManifest = (params: {
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

export const validateProvenanceManifest = (payload: ProvenanceManifest) => {
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
