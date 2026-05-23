import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPublishedMetaPath } from './registryUtils'
import { parseRollbackArgs } from './rollbackPackArgs'
import {
  buildRollbackSwapBackupPath,
  listRollbackBackups,
  readCurrentDatasetHash,
  resolveRollbackTarget,
} from './rollbackPackBackups'
import { writeRollbackOutputs } from './rollbackPackOutputs'
import type { RollbackOptions } from './rollbackPackTypes'

export const rollbackPack = async (options: RollbackOptions) => {
  const baseDir = options.baseDir
  const districtId = options.districtId
  const backupRoot = path.resolve(baseDir, '.backup')
  const destDir = path.resolve(baseDir, districtId)

  const backups = await listRollbackBackups(backupRoot, districtId)
  const target = resolveRollbackTarget(backups, districtId, options.backupId)

  const targetPath = path.resolve(backupRoot, target.name)
  const currentHash = await readCurrentDatasetHash(destDir)
  const swapBackup = buildRollbackSwapBackupPath(backupRoot, districtId, currentHash)

  await fs.rename(destDir, swapBackup)
  await fs.rename(targetPath, destDir)

  const metaPath = readPublishedMetaPath(destDir)
  await writeRollbackOutputs({
    baseDir,
    districtId,
    fromBackupName: target.name,
    swapBackupName: path.basename(swapBackup),
    metaPath,
  })
}

const run = async () => {
  const args = parseRollbackArgs(process.argv)
  if (!args.districtId) {
    throw new Error('Missing --district <id>')
  }

  await rollbackPack({
    baseDir: args.baseDir ?? 'public/data/generated',
    districtId: args.districtId,
    backupId: args.backupId ?? undefined,
    latest: args.latest,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
