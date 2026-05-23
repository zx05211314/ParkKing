import { describe, expect, it } from 'vitest'
import { comparePublicWriteSnapshots } from './assertNoPublicWriteDiff'

describe('assertNoPublicWriteDiff', () => {
  it('reports added, removed, and changed file paths', () => {
    expect(
      comparePublicWriteSnapshots(
        {
          baseDir: 'a',
          createdAt: '1',
          files: [
            { path: 'same.json', mtimeMs: 1, size: 10 },
            { path: 'remove.json', mtimeMs: 1, size: 10 },
            { path: 'change.json', mtimeMs: 1, size: 10 },
          ],
        },
        {
          baseDir: 'a',
          createdAt: '2',
          files: [
            { path: 'same.json', mtimeMs: 1, size: 10 },
            { path: 'change.json', mtimeMs: 2, size: 10 },
            { path: 'add.json', mtimeMs: 1, size: 10 },
          ],
        },
      ),
    ).toEqual({
      added: ['add.json'],
      removed: ['remove.json'],
      changed: ['change.json'],
    })
  })
})
