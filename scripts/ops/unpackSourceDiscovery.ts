import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { hasZipExt } from './unpackSourceZip'

export const listZipFiles = async (sourceRoot: string) => {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && hasZipExt(entry.name, '.zip'))
    .map((entry) => path.resolve(sourceRoot, entry.name))
    .sort((a, b) => a.localeCompare(b))
}
