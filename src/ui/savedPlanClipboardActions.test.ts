import { describe, expect, it, vi } from 'vitest'
import { copySavedPlanUrls } from './savedPlanClipboardActions'

describe('savedPlanClipboardActions', () => {
  it('returns an error status when there are no urls to copy', async () => {
    await expect(
      copySavedPlanUrls({
        urls: [],
        emptyMessage: 'No saved plans to copy.',
        getSuccessMessage: (count) => `${count} copied`,
      }),
    ).resolves.toEqual({
      kind: 'error',
      message: 'No saved plans to copy.',
    })
  })

  it('copies joined urls and returns a success status', async () => {
    const copyText = vi.fn().mockResolvedValue(undefined)

    await expect(
      copySavedPlanUrls({
        urls: ['one', 'two'],
        emptyMessage: 'No saved plans to copy.',
        getSuccessMessage: (count) =>
          count === 1 ? 'Saved plan link copied.' : 'Saved plan links copied.',
        copyText,
      }),
    ).resolves.toEqual({
      kind: 'success',
      message: 'Saved plan links copied.',
    })

    expect(copyText).toHaveBeenCalledWith('one\ntwo')
  })

  it('surfaces clipboard failures as an error status', async () => {
    await expect(
      copySavedPlanUrls({
        urls: ['one'],
        emptyMessage: 'No saved plans to copy.',
        getSuccessMessage: () => 'Saved plan link copied.',
        copyText: () => Promise.reject(new Error('Clipboard unavailable.')),
      }),
    ).resolves.toEqual({
      kind: 'error',
      message: 'Clipboard unavailable.',
    })
  })
})
