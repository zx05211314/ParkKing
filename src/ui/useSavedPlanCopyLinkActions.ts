import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { copySavedPlanUrls } from './savedPlanClipboardActions'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanCopyLinkActionsOptions {
  topVisibleSavedPlan: SavedPlan | null
  visibleSavedPlanIntentLeaders: SavedPlan[]
  comparedSavedPlans: SavedPlan[]
  savedPlanIntentLabels: Record<SavedPlanIntent, string>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanCopyLinkActionsResult {
  handleCopySavedPlanLink: (url: string) => Promise<void>
  handleCopyTopSavedPlanLink: () => Promise<void>
  handleCopySavedPlanIntentLinks: (
    intent: SavedPlanIntent,
    plans: SavedPlan[],
  ) => Promise<void>
  handleCopySavedPlanIntentLeaderLinks: () => Promise<void>
  handleCopyComparedSavedPlanLinks: () => Promise<void>
  handleCopySavedPlanGroupLinks: (plans: SavedPlan[]) => Promise<void>
}

export const useSavedPlanCopyLinkActions = ({
  topVisibleSavedPlan,
  visibleSavedPlanIntentLeaders,
  comparedSavedPlans,
  savedPlanIntentLabels,
  setShareStatus,
}: UseSavedPlanCopyLinkActionsOptions): UseSavedPlanCopyLinkActionsResult => {
  const handleCopySavedPlanLink = useCallback(
    async (url: string) => {
      setShareStatus(
        await copySavedPlanUrls({
          urls: [url],
          emptyMessage: 'No saved plans to copy.',
          getSuccessMessage: () => 'Saved plan link copied.',
        }),
      )
    },
    [setShareStatus],
  )

  const handleCopyTopSavedPlanLink = useCallback(async () => {
    setShareStatus(
      await copySavedPlanUrls({
        urls: topVisibleSavedPlan ? [topVisibleSavedPlan.url] : [],
        emptyMessage: 'No visible saved plans to copy.',
        getSuccessMessage: () => 'Saved plan link copied.',
      }),
    )
  }, [setShareStatus, topVisibleSavedPlan])

  const handleCopySavedPlanIntentLinks = useCallback(
    async (intent: SavedPlanIntent, plans: SavedPlan[]) => {
      setShareStatus(
        await copySavedPlanUrls({
          urls: plans.map((plan) => plan.url),
          emptyMessage: `No ${savedPlanIntentLabels[intent].toLowerCase()} saved plans to copy.`,
          getSuccessMessage: (count) =>
            count === 1
              ? `${savedPlanIntentLabels[intent]} link copied.`
              : `${savedPlanIntentLabels[intent]} links copied.`,
        }),
      )
    },
    [savedPlanIntentLabels, setShareStatus],
  )

  const handleCopySavedPlanIntentLeaderLinks = useCallback(async () => {
    setShareStatus(
      await copySavedPlanUrls({
        urls: visibleSavedPlanIntentLeaders.map((plan) => plan.url),
        emptyMessage: 'No visible intent leaders to copy.',
        getSuccessMessage: (count) =>
          count === 1 ? 'Intent leader link copied.' : 'Intent leader links copied.',
      }),
    )
  }, [setShareStatus, visibleSavedPlanIntentLeaders])

  const handleCopyComparedSavedPlanLinks = useCallback(async () => {
    setShareStatus(
      await copySavedPlanUrls({
        urls: comparedSavedPlans.map((plan) => plan.url),
        emptyMessage: 'No compared saved plans to copy.',
        getSuccessMessage: (count) =>
          count === 1
            ? 'Compared saved plan link copied.'
            : 'Compared saved plan links copied.',
      }),
    )
  }, [comparedSavedPlans, setShareStatus])

  const handleCopySavedPlanGroupLinks = useCallback(
    async (plans: SavedPlan[]) => {
      setShareStatus(
        await copySavedPlanUrls({
          urls: plans.map((plan) => plan.url),
          emptyMessage: 'No saved plans in that group to copy.',
          getSuccessMessage: (count) =>
            count === 1
              ? 'Group saved plan link copied.'
              : 'Group saved plan links copied.',
        }),
      )
    },
    [setShareStatus],
  )

  return {
    handleCopySavedPlanLink,
    handleCopyTopSavedPlanLink,
    handleCopySavedPlanIntentLinks,
    handleCopySavedPlanIntentLeaderLinks,
    handleCopyComparedSavedPlanLinks,
    handleCopySavedPlanGroupLinks,
  }
}
