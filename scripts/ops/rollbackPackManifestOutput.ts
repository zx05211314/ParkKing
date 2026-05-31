import {
  buildLatestPointer,
  type LatestPointer,
  writeLatestPointer,
} from './latestPointer'
import { writePublishManifest } from './manifestWriter'
import { readRollbackPublishedMetaState } from './rollbackPackPublishedMetaState'

export const writeRollbackManifestAndLatestPointer = async (params: {
  baseDir: string
  districtId: string
  metaPath: string
}): Promise<{ manifestPath: string; latestPointer: LatestPointer }> => {
  const { meta, files, metaSha256, packSha256, publishedAt } =
    await readRollbackPublishedMetaState(params.metaPath)

  let manifestPath = ''
  if (files) {
    manifestPath = await writePublishManifest({
      baseDir: params.baseDir,
      manifest: {
        districtId: params.districtId,
        districtName: (meta.districtName as string) ?? params.districtId,
        schemaVersion: Number(meta.schemaVersion ?? 0),
        datasetHash: (meta.datasetHash as string) ?? 'unknown',
        configHash: (meta.configHash as string) ?? 'unknown',
        generatedAt: (meta.generatedAt as string) ?? '',
        publishedAt,
        metaSha256,
        packSha256,
        totalBytes: Number(meta.totalBytes ?? 0),
        files,
        gateResult: 'ROLLBACK',
        toolVersions: {
          node: process.version,
        },
      },
    })
  }

  const latestPointer = buildLatestPointer({
    datasetHash: (meta.datasetHash as string) ?? 'unknown',
    publishedAt,
    manifestPath,
    schemaVersion: Number(meta.schemaVersion ?? 0),
  })
  await writeLatestPointer(params.baseDir, params.districtId, latestPointer)

  return { manifestPath, latestPointer }
}
