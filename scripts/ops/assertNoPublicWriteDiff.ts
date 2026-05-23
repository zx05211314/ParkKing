import type { PublicWriteSnapshot } from './assertNoPublicWriteTypes'

export const comparePublicWriteSnapshots = (
  baseline: PublicWriteSnapshot,
  current: PublicWriteSnapshot,
) => {
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
