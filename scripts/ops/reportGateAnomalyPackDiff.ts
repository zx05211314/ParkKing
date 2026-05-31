import * as path from 'node:path'
import { diffPacks } from './diffPacks'
import type { PackDiffReport } from './diffPackTypes'
import { fileExists, readJson } from './diffPackFiles'

export const resolveDiffReport = async (
  districtId: string,
  packPath: string,
): Promise<{ path: string | null; report: PackDiffReport | null }> => {
  const diffReportPath = path.resolve(packPath, 'diff_report.json')
  if (await fileExists(diffReportPath)) {
    return {
      path: diffReportPath,
      report: await readJson<PackDiffReport>(diffReportPath),
    }
  }

  const parentCandidate = path.resolve(path.dirname(packPath), districtId)
  if (
    parentCandidate !== packPath &&
    (await fileExists(path.resolve(parentCandidate, 'dataset_meta.json')))
  ) {
    const report = await diffPacks({
      prevDir: parentCandidate,
      nextDir: packPath,
    })
    return { path: null, report }
  }

  return { path: null, report: null }
}
