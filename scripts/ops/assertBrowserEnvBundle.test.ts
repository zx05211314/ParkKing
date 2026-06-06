import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertBrowserEnvBundle,
  parseModuleEntrySources,
} from './assertBrowserEnvBundle'

const roots: string[] = []

const createDist = async (
  entryContent: string,
  lazyContent: string | null = null,
) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-browser-env-'))
  roots.push(root)
  const assetsDir = path.join(root, 'assets')
  await fs.mkdir(assetsDir, { recursive: true })
  await fs.writeFile(
    path.join(root, 'index.html'),
    '<script type="module" crossorigin src="/assets/index.js"></script>',
  )
  await fs.writeFile(path.join(assetsDir, 'index.js'), entryContent)
  if (lazyContent !== null) {
    await fs.writeFile(path.join(assetsDir, 'lazy.js'), lazyContent)
  }
  return root
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  )
})

describe('assertBrowserEnvBundle', () => {
  it('parses local Vite module entry sources', () => {
    expect(
      parseModuleEntrySources(
        '<script type="module" crossorigin src="/assets/index.js"></script>',
      ),
    ).toEqual(['/assets/index.js'])
  })

  it('accepts bundles with statically replaced environment values', async () => {
    const distDir = await createDist('const syncBase="/api/sync";')

    await expect(assertBrowserEnvBundle({ distDir })).resolves.toMatchObject({
      entryFiles: [path.join(distDir, 'assets', 'index.js')],
      bundleFiles: [path.join(distDir, 'assets', 'index.js')],
    })
  })

  it('rejects unresolved import.meta.env access in lazy chunks', async () => {
    const distDir = await createDist(
      'const syncBase="/api/sync";',
      'const env=import.meta.env;',
    )

    await expect(assertBrowserEnvBundle({ distDir })).rejects.toThrow(
      'Unresolved import.meta.env access remains',
    )
  })
})
