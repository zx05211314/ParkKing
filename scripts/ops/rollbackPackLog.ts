import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export const appendRollbackLog = async (
  baseDir: string,
  payload: Record<string, unknown>,
) => {
  const opsDir = path.resolve(baseDir, '_ops')
  await fs.mkdir(opsDir, { recursive: true })
  const logPath = path.resolve(opsDir, 'rollback_log.jsonl')
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8')
}
