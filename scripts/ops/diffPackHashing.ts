import * as fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

export interface FileEntry {
  sha256: string
  bytes: number
}

export const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

export const hashFile = async (filePath: string): Promise<FileEntry> => {
  const buffer = await fs.readFile(filePath)
  return { sha256: hashBuffer(buffer), bytes: buffer.length }
}
