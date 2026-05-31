import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export const collectOptionalReleaseFiles = async (baseDir: string) => {
  const files: string[] = []
  const candidates = [
    path.resolve(baseDir, 'ingest_all_report.json'),
    path.resolve(baseDir, '_ops', 'publish_gate_summary.json'),
    path.resolve(baseDir, '_ops', 'publish_gate_summary.md'),
  ]

  for (const filePath of candidates) {
    try {
      await fs.access(filePath)
      files.push(filePath)
    } catch {
      // ignore
    }
  }

  return files
}
