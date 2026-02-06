import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import crypto from 'node:crypto'
import { hashFiles } from './hashFiles'

const hashString = (value: string) => {
  return crypto.createHash('sha256').update(value).digest('hex')
}

describe('hashFiles', () => {
  it('computes stable hashes', async () => {
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'hash-test-'))
    const fileName = 'alpha.txt'
    const filePath = path.join(dir, fileName)
    const content = 'hello'
    await fs.writeFile(filePath, content, 'utf-8')

    const result = await hashFiles(dir, [fileName])

    expect(result.files[fileName]?.sha256).toBe(hashString(content))
    expect(result.files[fileName]?.bytes).toBe(Buffer.byteLength(content))
    expect(result.totalBytes).toBe(Buffer.byteLength(content))
  })
})
