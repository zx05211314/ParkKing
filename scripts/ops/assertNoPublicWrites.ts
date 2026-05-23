import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAssertNoPublicWriteArgs } from './assertNoPublicWriteArgs'
import { comparePublicWriteSnapshots } from './assertNoPublicWriteDiff'
import {
  listPublicWriteFiles,
  loadPublicWriteSnapshot,
  writePublicWriteSnapshot,
} from './assertNoPublicWriteFiles'
import type { PublicWriteSnapshot } from './assertNoPublicWriteTypes'

export const assertNoPublicWrites = async (params: {
  baseDir: string
  baselinePath?: string | null
  checkPath?: string | null
}) => {
  const baseDir = params.baseDir
  if (params.baselinePath) {
    const files = await listPublicWriteFiles(baseDir)
    const snapshot: PublicWriteSnapshot = {
      baseDir,
      createdAt: new Date().toISOString(),
      files,
    }
    await writePublicWriteSnapshot(params.baselinePath, snapshot)
    return snapshot
  }

  if (!params.checkPath) {
    throw new Error('Must provide --baseline or --check')
  }

  const baseline = await loadPublicWriteSnapshot(params.checkPath)
  const files = await listPublicWriteFiles(baseDir)
  const current: PublicWriteSnapshot = {
    baseDir,
    createdAt: new Date().toISOString(),
    files,
  }

  const diff = comparePublicWriteSnapshots(baseline, current)
  if (diff.added.length || diff.removed.length || diff.changed.length) {
    const summarize = (label: string, list: string[]) =>
      list.length > 0 ? `${label}: ${list.slice(0, 10).join(', ')}` : null
    const lines = [
      summarize('added', diff.added),
      summarize('removed', diff.removed),
      summarize('changed', diff.changed),
    ].filter(Boolean)
    throw new Error(`public/ writes detected. ${lines.join(' | ')}`)
  }

  return current
}

const run = async () => {
  const args = parseAssertNoPublicWriteArgs(process.argv)
  const baseDir = args.baseDir ?? path.resolve('public/data/generated')
  await assertNoPublicWrites({
    baseDir,
    baselinePath: args.baselinePath,
    checkPath: args.checkPath,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
