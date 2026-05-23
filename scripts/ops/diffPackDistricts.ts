import {
  type FileEntry,
} from './diffPackHashing'
import { buildFileMap } from './diffPackFileMap'
import { getMetaFiles, readMeta } from './diffPackMetaState'
import {
  buildDistrictMetaDiff,
} from './diffPackMetrics'
import type { DiffSeverity, DistrictDiff } from './diffPackTypes'
import { diffDistrictFiles, resolveDistrictDiffStatus } from './diffPackDistrictFiles'
import { buildDistrictDiffIssues, resolveDistrictDiffSeverity } from './diffPackDistrictIssues'

export const buildDistrictDiff = async (params: {
  districtId: string
  prevDir: string | null
  nextDir: string | null
}): Promise<DistrictDiff> => {
  const prevMeta = params.prevDir ? await readMeta(params.prevDir) : null
  const nextMeta = params.nextDir ? await readMeta(params.nextDir) : null

  const prevFiles = params.prevDir
    ? await buildFileMap(params.prevDir, getMetaFiles(prevMeta))
    : new Map<string, FileEntry>()
  const nextFiles = params.nextDir
    ? await buildFileMap(params.nextDir, getMetaFiles(nextMeta))
    : new Map<string, FileEntry>()

  const files = diffDistrictFiles(prevFiles, nextFiles)
  const meta = buildDistrictMetaDiff(prevMeta, nextMeta)

  const issues = buildDistrictDiffIssues({
    districtId: params.districtId,
    segmentsCount: meta.segmentsCount,
    overridesAppliedCount: meta.overridesAppliedCount,
    signOverrideUnmatchedNamedCount: meta.signOverrideUnmatchedNamedCount,
    curbMarkingKnownRate: meta.curbMarkingKnownRate,
    restrictionTriggeredRate: meta.restrictionTriggeredRate,
    boundaryBBox: meta.boundaryBBox,
  })

  const severity: DiffSeverity = resolveDistrictDiffSeverity(issues)
  const status = resolveDistrictDiffStatus({
    prevDir: params.prevDir,
    nextDir: params.nextDir,
    files,
    meta,
  })

  return {
    districtId: params.districtId,
    status,
    severity,
    issues,
    meta,
    files,
  }
}
