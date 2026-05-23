import { copyTextToClipboard } from './clipboard'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface CopySavedPlanUrlsOptions {
  urls: string[]
  emptyMessage: string
  getSuccessMessage: (count: number) => string
  copyText?: (value: string) => Promise<void>
}

export const copySavedPlanUrls = async ({
  urls,
  emptyMessage,
  getSuccessMessage,
  copyText = copyTextToClipboard,
}: CopySavedPlanUrlsOptions): Promise<TripBoardActionStatus> => {
  if (urls.length === 0) {
    return {
      kind: 'error',
      message: emptyMessage,
    }
  }

  try {
    await copyText(urls.join('\n'))
    return {
      kind: 'success',
      message: getSuccessMessage(urls.length),
    }
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Share link unavailable.',
    }
  }
}
