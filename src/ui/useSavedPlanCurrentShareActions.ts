import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { copyTextToClipboard } from './clipboard'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanCurrentShareActionsOptions {
  currentShareUrl: string | null
  searchLocationLabel: string | null
  selectedSegmentName: string | null
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanCurrentShareActionsResult {
  handleCopyShareLink: () => Promise<void>
  handleNativeShare: () => Promise<void>
}

export const useSavedPlanCurrentShareActions = ({
  currentShareUrl,
  searchLocationLabel,
  selectedSegmentName,
  setShareStatus,
}: UseSavedPlanCurrentShareActionsOptions): UseSavedPlanCurrentShareActionsResult => {
  const handleCopyShareLink = useCallback(async () => {
    if (!currentShareUrl) {
      setShareStatus({
        kind: 'error',
        message: 'Pick an address or parking target first.',
      })
      return
    }

    try {
      await copyTextToClipboard(currentShareUrl)
      setShareStatus({
        kind: 'success',
        message: 'Share link copied.',
      })
    } catch (error) {
      setShareStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Share link unavailable.',
      })
    }
  }, [currentShareUrl, setShareStatus])

  const handleNativeShare = useCallback(async () => {
    if (
      !currentShareUrl ||
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function'
    ) {
      return
    }

    try {
      await navigator.share({
        title: selectedSegmentName
          ? `${selectedSegmentName} parking option`
          : 'ParkKing parking view',
        text: searchLocationLabel
          ? `Pinned location: ${searchLocationLabel}`
          : 'ParkKing parking view',
        url: currentShareUrl,
      })
      setShareStatus({
        kind: 'success',
        message: 'Share sheet opened.',
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      setShareStatus({
        kind: 'error',
        message: 'Share failed.',
      })
    }
  }, [currentShareUrl, searchLocationLabel, selectedSegmentName, setShareStatus])

  return {
    handleCopyShareLink,
    handleNativeShare,
  }
}
