import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { resolveDistrictSourceContext } from './fetchSourcesContext'
import { resolveSourceDestinations } from './fetchSourcesManifestPaths'
import {
  buildProvenanceManifest,
  validateProvenanceManifest,
} from './fetchSourcesProvenance'
import { fetchSourceFile } from './fetchSourcesSourceFile'
import type { DistrictSourceManifest } from './fetchSourcesTypes'

export const fetchDistrictSources = async (params: {
  districtManifest: DistrictSourceManifest
  manifestDir: string
  provenanceRoot: string
  dryRun: boolean
}) => {
  const sources = params.districtManifest.sources ?? []
  if (sources.length === 0) {
    return false
  }

  const resolvedDestinations = resolveSourceDestinations(sources, params.manifestDir)
  const { configDistrictId, configHash } = await resolveDistrictSourceContext({
    manifest: params.districtManifest,
    manifestDir: params.manifestDir,
    resolvedDestinations,
  })

  const fileEntries = (
    await Promise.all(
      sources.map((source) =>
        fetchSourceFile({
          source,
          manifestDir: params.manifestDir,
          provenanceRoot: params.provenanceRoot,
          dryRun: params.dryRun,
        }),
      ),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  if (params.dryRun) {
    return true
  }

  const provenance = buildProvenanceManifest({
    districtId: configDistrictId,
    fetchedAt: new Date().toISOString(),
    configHash,
    files: fileEntries,
  })
  validateProvenanceManifest(provenance)
  const provenanceDir = path.resolve(params.provenanceRoot, 'data', 'sources', configDistrictId)
  await fs.mkdir(provenanceDir, { recursive: true })
  const provenancePath = path.resolve(provenanceDir, 'provenance.json')
  await fs.writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf-8')

  return true
}
