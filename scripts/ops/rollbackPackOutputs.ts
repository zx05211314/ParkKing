import { appendRollbackLog } from './rollbackPackLog'
import { writeRollbackManifestAndLatestPointer } from './rollbackPackPublishState'
import { updateRollbackRegistry } from './rollbackPackRegistry'

export const writeRollbackOutputs = async (params: {
  baseDir: string
  districtId: string
  fromBackupName: string
  swapBackupName: string
  metaPath: string
}) => {
  await updateRollbackRegistry({
    baseDir: params.baseDir,
    districtId: params.districtId,
    metaPath: params.metaPath,
  })

  await appendRollbackLog(params.baseDir, {
    timestamp: new Date().toISOString(),
    districtId: params.districtId,
    from: params.fromBackupName,
    swappedTo: params.swapBackupName,
  })
  await writeRollbackManifestAndLatestPointer({
    baseDir: params.baseDir,
    districtId: params.districtId,
    metaPath: params.metaPath,
  })
}
