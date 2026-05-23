import type { FileEntry } from './diffPackFiles'
import type { DistrictMetaDiff } from './diffPackMetrics'

export type DiffSeverity = 'OK' | 'WARN' | 'FAIL'

export interface DiffIssue {
  severity: 'WARN' | 'FAIL'
  code: string
  message: string
  metric?: Record<string, unknown>
  threshold?: Record<string, unknown>
}

export interface PackDiffReport {
  schemaVersion: number
  generatedAt: string
  prevPath: string | null
  nextPath: string
  firstPublish: boolean
  districts: DistrictDiff[]
  summary: {
    districtsAdded: string[]
    districtsRemoved: string[]
    totalChangedFiles: number
  }
}

export interface DistrictDiff {
  districtId: string
  status: 'ADDED' | 'REMOVED' | 'UPDATED' | 'UNCHANGED'
  severity: DiffSeverity
  issues: DiffIssue[]
  meta: DistrictMetaDiff
  files: {
    added: string[]
    removed: string[]
    modified: Array<{
      path: string
      prev: FileEntry | null
      next: FileEntry | null
    }>
  }
}
