import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  parseBundleBudgetArgs,
  renderBundleBudget,
  runBundleBudget,
} from './bundleBudget'

let tempRoot: string

const writeDist = async (
  indexHtml: string,
  assets: Record<string, number>,
) => {
  const distDir = path.join(tempRoot, 'dist')
  await fs.mkdir(path.join(distDir, 'assets'), { recursive: true })
  await fs.writeFile(path.join(distDir, 'index.html'), indexHtml)
  await Promise.all(
    Object.entries(assets).map(([name, bytes]) =>
      fs.writeFile(path.join(distDir, 'assets', name), 'x'.repeat(bytes)),
    ),
  )
  return distDir
}

describe('bundleBudget', () => {
  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-bundle-budget-'))
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('parses bundle budget CLI options', () => {
    expect(
      parseBundleBudgetArgs([
        'node',
        'bundleBudget',
        '--dist',
        'dist',
        '--max-entry-bytes',
        '123',
        '--max-initial-js-bytes',
        '456',
        '--forbid-initial',
        'turf,maplibre',
        '--json',
      ]),
    ).toMatchObject({
      distDir: 'dist',
      maxEntryBytes: 123,
      maxInitialJsBytes: 456,
      forbiddenInitialPatterns: ['turf', 'maplibre'],
      json: true,
    })
  })

  it('passes when the entry and module preloads are under budget', async () => {
    const distDir = await writeDist(
      '<script type="module" crossorigin src="/assets/index.js"></script><link rel="modulepreload" crossorigin href="/assets/vendor.js">',
      {
        'index.js': 100,
        'vendor.js': 50,
      },
    )

    const result = await runBundleBudget({
      distDir,
      maxEntryBytes: 120,
      maxInitialJsBytes: 200,
    })

    expect(result.pass).toBe(true)
    expect(renderBundleBudget(result)).toContain('# Bundle Budget: PASS')
  })

  it('blocks forbidden heavy chunks from initial modulepreload', async () => {
    const distDir = await writeDist(
      '<script type="module" crossorigin src="/assets/index.js"></script><link rel="modulepreload" crossorigin href="/assets/turf.js"><link rel="modulepreload" crossorigin href="/assets/rbush.js">',
      {
        'index.js': 100,
        'turf.js': 50,
        'rbush.js': 20,
      },
    )

    const result = await runBundleBudget({ distDir })

    expect(result.pass).toBe(false)
    expect(result.violations).toEqual([
      'forbidden initial chunk turf: /assets/turf.js',
      'forbidden initial chunk rbush: /assets/rbush.js',
    ])
  })

  it('blocks entry and initial JS budget overages', async () => {
    const distDir = await writeDist(
      '<script type="module" crossorigin src="/assets/index.js"></script><link rel="modulepreload" crossorigin href="/assets/vendor.js">',
      {
        'index.js': 150,
        'vendor.js': 100,
      },
    )

    const result = await runBundleBudget({
      distDir,
      maxEntryBytes: 120,
      maxInitialJsBytes: 200,
    })

    expect(result.pass).toBe(false)
    expect(result.violations).toEqual([
      'entry /assets/index.js is 150 bytes > 120',
      'initial JS is 250 bytes > 200',
    ])
  })
})
