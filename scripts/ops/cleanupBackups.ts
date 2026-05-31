import { fileURLToPath } from 'node:url'
import { parseCleanupBackupsArgs } from './cleanupBackupsArgs'
import { resolveCleanupBackupsOptions } from './cleanupBackupsOptions'
import { cleanupBackups } from './cleanupBackupsWorkflow'

export { cleanupBackups } from './cleanupBackupsWorkflow'
export type { CleanupOptions } from './cleanupBackupsWorkflow'

const run = async () => {
  const args = parseCleanupBackupsArgs(process.argv)
  const removed = await cleanupBackups(resolveCleanupBackupsOptions(args))

  console.log(`Removed ${removed.length} backup/staging entries.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
