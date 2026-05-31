import * as path from 'node:path'
import fg from 'fast-glob'

const isExcludedReleaseFile = (filePath: string) =>
  filePath.includes('/.backup/') || filePath.includes('/.staging/')

export const collectIncludedReleaseFiles = async (includeGlob: string) => {
  const includeMatches = await fg(includeGlob, { onlyFiles: true })
  return includeMatches
    .map((entry) => path.resolve(entry))
    .filter((entry) => !isExcludedReleaseFile(entry.replace(/\\/g, '/')))
}
