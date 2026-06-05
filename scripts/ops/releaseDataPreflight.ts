import { fileURLToPath } from 'node:url'
import { runSignOverridePreflightBatch } from './signOverridePreflightBatch'

const DEFAULT_CONFIGS_GLOB = 'configs/prod/*.json'
const DEFAULT_OUT_DIR = '.tmp/sign-override-preflight'

export const runReleaseDataPreflight = async (params?: {
  configsGlob?: string | null
  outDir?: string | null
}) => {
  const result = await runSignOverridePreflightBatch({
    configsGlob:
      params?.configsGlob?.trim() ||
      process.env.RELEASE_CONFIGS_GLOB ||
      DEFAULT_CONFIGS_GLOB,
    outDir: params?.outDir?.trim() || DEFAULT_OUT_DIR,
  })
  console.log(
    `Release data preflight checked ${result.configPaths.length} config(s)`,
  )
  if (result.hasErrors) {
    throw new Error(result.errors.join('\n'))
  }
  return result
}

const run = async () => {
  await runReleaseDataPreflight()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
