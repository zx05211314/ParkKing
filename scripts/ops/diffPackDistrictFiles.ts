import type { FileEntry } from './diffPackFiles'
import { hasMetaChanges } from './diffPackMetrics'
import type { DistrictDiff } from './diffPackTypes'

export const diffDistrictFiles = (
  prevFiles: Map<string, FileEntry>,
  nextFiles: Map<string, FileEntry>,
) => {
  const prevKeys = Array.from(prevFiles.keys())
  const nextKeys = Array.from(nextFiles.keys())
  prevKeys.sort((a, b) => a.localeCompare(b))
  nextKeys.sort((a, b) => a.localeCompare(b))

  const added: string[] = []
  const removed: string[] = []
  const modified: Array<{ path: string; prev: FileEntry | null; next: FileEntry | null }> = []

  const prevSet = new Set(prevKeys)
  const nextSet = new Set(nextKeys)

  nextKeys.forEach((key) => {
    if (!prevSet.has(key)) {
      added.push(key)
      return
    }
    const prev = prevFiles.get(key)
    const next = nextFiles.get(key)
    if (prev && next && prev.sha256 !== next.sha256) {
      modified.push({ path: key, prev, next })
    }
  })

  prevKeys.forEach((key) => {
    if (!nextSet.has(key)) {
      removed.push(key)
    }
  })

  modified.sort((a, b) => a.path.localeCompare(b.path))

  return { added, removed, modified }
}

export const resolveDistrictDiffStatus = (params: {
  prevDir: string | null
  nextDir: string | null
  files: DistrictDiff['files']
  meta: DistrictDiff['meta']
}): DistrictDiff['status'] => {
  if (!params.prevDir && params.nextDir) {
    return 'ADDED'
  }
  if (params.prevDir && !params.nextDir) {
    return 'REMOVED'
  }
  if (params.prevDir && params.nextDir) {
    const hasFileChanges =
      params.files.added.length > 0 ||
      params.files.removed.length > 0 ||
      params.files.modified.length > 0
    return hasFileChanges || hasMetaChanges(params.meta) ? 'UPDATED' : 'UNCHANGED'
  }
  return 'UNCHANGED'
}
