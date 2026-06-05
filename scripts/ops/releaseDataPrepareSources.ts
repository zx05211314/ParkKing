import { fileURLToPath } from 'node:url'
import { fetchSources } from './fetchSources'
import { unpackSources } from './unpackSources'

const DEFAULT_PROD_MANIFEST = 'configs/sources.prod.taipei.json'
const DEFAULT_SOURCE_DIR = 'data/sources/shared'

export const shouldPrepareProductionSources = (configsGlob: string) =>
  configsGlob.startsWith('configs/prod/')

export const prepareReleaseDataSources = async (
  configsGlob = process.env.RELEASE_CONFIGS_GLOB ?? 'configs/prod/*.json',
) => {
  if (!shouldPrepareProductionSources(configsGlob)) {
    console.log(`Skipping production source preparation for ${configsGlob}`)
    return false
  }
  await fetchSources({ manifestPath: DEFAULT_PROD_MANIFEST })
  await unpackSources({ sourceDir: DEFAULT_SOURCE_DIR })
  return true
}

const run = async () => {
  await prepareReleaseDataSources()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
