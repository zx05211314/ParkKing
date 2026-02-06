import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface FileSnapshotEntry {
  path: string
  mtimeMs: number
  size: number
}

interface Snapshot {
  baseDir: string
  createdAt: string
  files: FileSnapshotEntry[]
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const baselineIndex = args.findIndex((arg) => arg === '--baseline')
  const checkIndex = args.findIndex((arg) => arg === '--check')
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  return {
    baselinePath: baselineIndex >= 0 ? args[baselineIndex + 1] : null,
    checkPath: checkIndex >= 0 ? args[checkIndex + 1] : null,
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] : null,
  }
}

const listFiles = async (baseDir: string): Promise<FileSnapshotEntry[]> => {
  try {
    await fs.access(baseDir)
  } catch {
    return []
  }

  const entries: FileSnapshotEntry[] = []
  const walk = async (dirPath: string) => {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true })
    for (const dirent of dirents) {
      const fullPath = path.resolve(dirPath, dirent.name)
      if (dirent.isDirectory()) {
        await walk(fullPath)
      } else if (dirent.isFile()) {
        const stat = await fs.stat(fullPath)
        entries.push({
          path: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        })
      }
    }
  }

  await walk(baseDir)
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

const writeSnapshot = async (snapshotPath: string, snapshot: Snapshot) => {
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true })
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8')
}

const loadSnapshot = async (snapshotPath: string): Promise<Snapshot> => {
  const raw = await fs.readFile(snapshotPath, 'utf-8')
  return JSON.parse(raw) as Snapshot
}

const compareSnapshots = (baseline: Snapshot, current: Snapshot) => {
  const baseMap = new Map(baseline.files.map((entry) => [entry.path, entry]))
  const currMap = new Map(current.files.map((entry) => [entry.path, entry]))

  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []

  for (const [filePath, baseEntry] of baseMap.entries()) {
    const currEntry = currMap.get(filePath)
    if (!currEntry) {
      removed.push(filePath)
      continue
    }
    if (currEntry.mtimeMs !== baseEntry.mtimeMs || currEntry.size !== baseEntry.size) {
      changed.push(filePath)
    }
  }

  for (const filePath of currMap.keys()) {
    if (!baseMap.has(filePath)) {
      added.push(filePath)
    }
  }

  return { added, removed, changed }
}

export const assertNoPublicWrites = async (params: {
  baseDir: string
  baselinePath?: string | null
  checkPath?: string | null
}) => {
  const baseDir = params.baseDir
  if (params.baselinePath) {
    const files = await listFiles(baseDir)
    const snapshot: Snapshot = {
      baseDir,
      createdAt: new Date().toISOString(),
      files,
    }
    await writeSnapshot(params.baselinePath, snapshot)
    return snapshot
  }

  if (!params.checkPath) {
    throw new Error('Must provide --baseline or --check')
  }

  const baseline = await loadSnapshot(params.checkPath)
  const files = await listFiles(baseDir)
  const current: Snapshot = {
    baseDir,
    createdAt: new Date().toISOString(),
    files,
  }

  const diff = compareSnapshots(baseline, current)
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
  const args = parseArgs(process.argv)
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
