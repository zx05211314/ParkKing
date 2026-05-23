import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseFetchSourcesArgs } from './fetchSourcesArgs'
import { fetchDistrictSources } from './fetchSourcesDistrictFetch'
import {
  listDistrictSourceManifests,
  readSourceManifest,
} from './fetchSourcesManifest'
import type { FetchSourcesParams } from './fetchSourcesTypes'

export const fetchSources = async (params: FetchSourcesParams) => {
  const manifestPath = path.resolve(params.manifestPath)
  const manifestDir = path.dirname(manifestPath)
  const manifest = await readSourceManifest(manifestPath)
  const provenanceRoot = params.provenanceRoot ?? process.cwd()
  const districtManifests = listDistrictSourceManifests(manifest)
  let hasSources = false

  for (const districtManifest of districtManifests) {
    const processed = await fetchDistrictSources({
      districtManifest,
      manifestDir,
      provenanceRoot,
      dryRun: Boolean(params.dryRun),
    })
    hasSources = hasSources || processed
  }

  if (!hasSources) {
    console.log('No sources defined in manifest.')
  }
}

const run = async () => {
  const args = parseFetchSourcesArgs(process.argv)
  const manifestPath = args.manifestPath ?? 'ops/sources.json'
  await fetchSources({ manifestPath, dryRun: args.dryRun })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
