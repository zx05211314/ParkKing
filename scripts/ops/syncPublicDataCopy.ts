import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const copySyncPublicDistricts = async (
  sourceRoot: string,
  targetRoot: string,
  districtIds: string[],
) => {
  for (const districtId of districtIds) {
    const sourceDir = path.resolve(sourceRoot, districtId)
    const targetDir = path.resolve(targetRoot, districtId)
    await fs.rm(targetDir, { recursive: true, force: true })
    await fs.cp(sourceDir, targetDir, { recursive: true, force: true })
  }
}

export const copySyncPublicArtifacts = async (
  sourceRoot: string,
  targetRoot: string,
) => {
  const artifactNames = ['registry.json', 'ingest_all_report.json']

  for (const artifactName of artifactNames) {
    const sourcePath = path.resolve(sourceRoot, artifactName)
    if (await fileExists(sourcePath)) {
      await fs.copyFile(sourcePath, path.resolve(targetRoot, artifactName))
    }
  }
}
