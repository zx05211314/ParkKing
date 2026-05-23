import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseUnpackSourceArgs } from './unpackSourceArgs'
import { listZipFiles, unpackZipFile } from './unpackSourceFiles'
export { chooseMainShpEntry } from './unpackSourceZip'
export type { UnpackSummary, ZipEntryInfo } from './unpackSourceTypes'

export const unpackSources = async (params?: { sourceDir?: string }) => {
  const sourceRoot = path.resolve(params?.sourceDir ?? 'data/sources/shared')
  const zipFiles = await listZipFiles(sourceRoot)
  if (zipFiles.length === 0) {
    console.log(`No zip files found in ${sourceRoot}`)
    return [] as UnpackSummary[]
  }

  const summaries: UnpackSummary[] = []
  for (const zipPath of zipFiles) {
    const summary = await unpackZipFile({ zipPath, sourceRoot })
    summaries.push(summary)
    console.log(`Unpacked ${path.basename(zipPath)} -> ${summary.canonicalShpPath}`)
  }
  return summaries
}

const run = async () => {
  const args = parseUnpackSourceArgs(process.argv)
  await unpackSources({ sourceDir: args.sourceDir ?? undefined })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
