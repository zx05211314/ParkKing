import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const writeIssueReportSummaryOutput = async (
  outPath: string,
  content: string,
  cwd = process.cwd(),
) => {
  const resolvedPath = resolve(cwd, outPath)
  await mkdir(dirname(resolvedPath), { recursive: true })
  await writeFile(resolvedPath, content, 'utf8')
  return resolvedPath
}
