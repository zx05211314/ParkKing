import * as path from 'node:path'

export const resolveOverrideReportsPath = (
  districtId: string,
  cwd = process.cwd(),
  overrideReportsDir = process.env.PARKKING_OVERRIDE_REPORTS_DIR?.trim(),
) => {
  const baseDir = overrideReportsDir
    ? path.isAbsolute(overrideReportsDir)
      ? overrideReportsDir
      : path.resolve(cwd, overrideReportsDir)
    : path.resolve(cwd, 'data', 'overrides')
  return path.resolve(baseDir, `${districtId}.jsonl`)
}
