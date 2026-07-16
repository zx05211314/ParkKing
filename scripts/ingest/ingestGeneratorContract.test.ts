import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildGeneratorContractHash } from './ingestGeneratorContract'

describe('ingestGeneratorContract', () => {
  it('tracks transitive imports without depending on absolute paths', async () => {
    const createTree = async (helperValue: string) => {
      const root = await fs.mkdtemp(path.join(tmpdir(), 'generator-contract-'))
      await fs.writeFile(
        path.join(root, 'entry.ts'),
        "import { value } from './helper'\nexport const result = value\n",
        'utf-8',
      )
      await fs.writeFile(
        path.join(root, 'helper.ts'),
        `export const value = '${helperValue}'\n`,
        'utf-8',
      )
      return root
    }

    const firstRoot = await createTree('v1')
    const secondRoot = await createTree('v1')
    const options = { entryFiles: ['entry.ts'], dependencyFiles: [] }

    expect(
      await buildGeneratorContractHash({ rootDir: firstRoot, ...options }),
    ).toBe(await buildGeneratorContractHash({ rootDir: secondRoot, ...options }))

    await fs.writeFile(
      path.join(secondRoot, 'helper.ts'),
      "export const value = 'v2'\n",
      'utf-8',
    )
    expect(
      await buildGeneratorContractHash({ rootDir: firstRoot, ...options }),
    ).not.toBe(await buildGeneratorContractHash({ rootDir: secondRoot, ...options }))
  })
})
