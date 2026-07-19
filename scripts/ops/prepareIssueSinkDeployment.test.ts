import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { prepareIssueSinkDeployment } from './prepareIssueSinkDeployment'

describe('prepareIssueSinkDeployment', () => {
  it('writes a local Wrangler config with the D1 database id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'parkking-issue-sink-'))
    const templatePath = join(root, 'wrangler.example.jsonc')
    const outputPath = join(root, 'wrangler.jsonc')
    await writeFile(
      templatePath,
      '{"database_id":"__D1_DATABASE_ID__"}\n',
      'utf8',
    )

    const result = await prepareIssueSinkDeployment({
      databaseId: '12345678-1234-1234-1234-123456789abc',
      templatePath,
      outputPath,
    })

    expect(result.outputPath).toBe(outputPath)
    await expect(readFile(outputPath, 'utf8')).resolves.toContain(
      '12345678-1234-1234-1234-123456789abc',
    )
  })

  it('rejects malformed database ids before writing config', async () => {
    await expect(
      prepareIssueSinkDeployment({
        databaseId: 'replace-me',
        templatePath: 'missing',
        outputPath: 'missing',
      }),
    ).rejects.toThrow('D1 database id is missing or invalid.')
  })
})
