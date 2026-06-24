import { fileURLToPath } from 'node:url'
import { parseArgs } from './sampleQaCandidateArgs'
import { discoverDistrictIds } from './sampleQaCandidateDataset'
import {
  buildQaCandidateManifest,
  writeQaCandidateManifest,
} from './sampleQaCandidateManifest'
import { writeQaCandidateReviewDoc } from './sampleQaCandidateReviewDoc'
import { renderQaCandidatesCsv } from './sampleQaCandidateOutput'
import {
  resolveSampleQaCandidateDistrictIds,
  resolveSampleQaCandidateParams,
  type SampleQaCandidateParams,
} from './sampleQaCandidateRequest'
import { buildQaCandidatePacket, buildQaCandidates } from './sampleQaCandidateRows'
import type { DistrictResult, QaCandidateRow } from './sampleQaCandidateTypes'
import { writeQaCandidates } from './sampleQaCandidateWrites'

export { parseArgs, buildQaCandidates, renderQaCandidatesCsv }
export type { QaCandidateRow }

export const sampleQaCandidates = async (
  params: SampleQaCandidateParams,
): Promise<DistrictResult[]> => {
  const resolved = resolveSampleQaCandidateParams(params)
  const districtIds = await resolveSampleQaCandidateDistrictIds({
    all: resolved.all,
    districtId: resolved.districtId,
    datasetRoots: resolved.datasetRoots,
    discoverDistrictIds,
  })
  const results: DistrictResult[] = []
  for (const districtId of districtIds) {
    const packet = await buildQaCandidatePacket({
      districtId,
      topN: resolved.topN,
      riskMode: resolved.riskMode,
      radiusMeters: resolved.radiusMeters,
      shuffle: resolved.shuffle,
      seed: resolved.seed,
      strategy: resolved.strategy,
      hhmm: resolved.hhmm,
      datasetRoots: resolved.datasetRoots,
    })
    const outPath = await writeQaCandidates({
      districtId,
      all: resolved.all,
      outPath: resolved.outPath,
      rows: packet.rows,
    })
    const manifest = buildQaCandidateManifest({
      districtId,
      csvPath: outPath,
      configRoot: resolved.configRoot,
      datasetBaseDir: packet.context.datasetBaseDir,
      datasetMeta: packet.context.datasetMeta,
      inputCounts: packet.context.inputCounts,
      rows: packet.rows,
      topN: resolved.topN,
      riskMode: resolved.riskMode,
      radiusMeters: resolved.radiusMeters,
      shuffle: resolved.shuffle,
      seed: resolved.seed,
      strategy: resolved.strategy,
      hhmm: resolved.hhmm,
    })
    const manifestPath = await writeQaCandidateManifest({
      districtId,
      all: resolved.all,
      csvOutPath: outPath,
      manifestOutPath: resolved.manifestOutPath,
      manifest,
    })
    const reviewDocPath = await writeQaCandidateReviewDoc({
      districtId,
      all: resolved.all,
      csvOutPath: outPath,
      reviewDocOutPath: resolved.reviewDocOutPath,
      manifest,
      rows: packet.rows,
    })
    results.push({
      districtId,
      outPath,
      manifestPath,
      reviewDocPath,
      rowCount: packet.rows.length,
    })
  }

  return results
}

const run = async () => {
  const args = parseArgs(process.argv)
  const results = await sampleQaCandidates({
    districtId: args.districtId,
    all: args.all,
    topN: args.topN,
    outPath: args.outPath,
    manifestOutPath: args.manifestOutPath,
    reviewDocOutPath: args.reviewDocOutPath,
    configRoot: args.configRoot,
    riskMode: args.riskMode,
    radiusMeters: args.radiusMeters,
    datasetRoots: args.datasetRoots.length > 0 ? args.datasetRoots : undefined,
    shuffle: args.shuffle,
    seed: args.seed,
    strategy: args.strategy,
    hhmm: args.hhmm,
  })
  results.forEach((result) => {
    console.log(
      `Wrote ${result.rowCount} QA candidates for ${result.districtId} to ${result.outPath}`,
    )
    console.log(
      `Wrote QA candidate manifest for ${result.districtId} to ${result.manifestPath}`,
    )
    console.log(
      `Wrote QA candidate review doc for ${result.districtId} to ${result.reviewDocPath}`,
    )
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
