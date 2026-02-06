import { fileURLToPath } from 'node:url'
import { readConfig } from './readConfig'
import { ingestBusStops } from './ingestBusStops'
import { ingestDistrictBounds } from './ingestDistrictBounds'
import { ingestHydrants } from './ingestHydrants'
import { ingestIntersections } from './ingestIntersections'
import { ingestRedYellow } from './ingestRedYellow'
import { ingestCrosswalks } from './ingestCrosswalks'
import { ingestSignOverrides } from './ingestSignOverrides'
import { ingestInferredCandidates } from './ingestInferredCandidates'
import { buildDatasetMeta, writeJson } from './utils'
import { validateOutputs } from './validateOutputs'
import { publishPackAtomic } from './publishPackAtomic'

const run = async () => {
  const config = await readConfig()
  await ingestDistrictBounds(config)
  await ingestRedYellow(config)
  await ingestBusStops(config)
  await ingestHydrants(config)
  await ingestCrosswalks(config)
  await ingestIntersections(config)
  await ingestSignOverrides(config)
  await ingestInferredCandidates(config)

  const meta = await buildDatasetMeta(config)
  await writeJson(config, 'dataset_meta.json', meta)

  await validateOutputs(config)
  await publishPackAtomic({
    sourceDir: config.outputs.generatedDir,
    destDir: config.outputs.publicDir,
  })

  console.log('Ingest pipeline complete.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
