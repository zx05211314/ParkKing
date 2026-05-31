import * as path from 'node:path'
import type { UnpackSummary } from './unpackSourceTypes'
import { copyCanonicalFiles, extractZipToDirectory } from './unpackSourceCopy'
import {
  chooseMainShpEntry,
  listZipEntries,
  resolveCompanionEntries,
} from './unpackSourceZip'

export const unpackZipFile = async (params: {
  zipPath: string
  sourceRoot: string
}): Promise<UnpackSummary> => {
  const zipPath = path.resolve(params.zipPath)
  const archiveBase = path.basename(zipPath, path.extname(zipPath))
  const outputDir = path.resolve(params.sourceRoot, archiveBase)
  const entries = listZipEntries(zipPath)
  const chosenShp = chooseMainShpEntry(entries)
  if (!chosenShp) {
    throw new Error(`No .shp file found in archive ${zipPath}`)
  }

  const companions = resolveCompanionEntries(entries, chosenShp)
  await extractZipToDirectory(zipPath, outputDir)
  const copied = await copyCanonicalFiles({
    outputDir,
    canonicalBaseName: archiveBase,
    chosenShp,
    requiredCompanions: companions.required,
    optionalCompanions: companions.optional,
  })

  return {
    archivePath: zipPath,
    outputDir,
    chosenShpEntry: chosenShp.normalizedPath,
    canonicalShpPath: copied.canonicalShpPath,
  }
}
export { listZipFiles } from './unpackSourceDiscovery'
