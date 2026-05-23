import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { loadSavedPlans } from '../api/savedPlansPersistence'
import { loadSyncBootstrapOnce } from '../api/syncBootstrap'
import { loadReports, readReports } from '../feedback/reports'
import type { SavedPlan } from './savedPlanTypes'
import type {
  StartupSyncHydrationPhase,
  StartupSyncHydrationSource,
} from './startupSyncHydrationState'

interface UseStartupSyncHydrationOptions {
  hydrateSavedPlans: (plans: SavedPlan[]) => void
  setSavedPlansHydrated: Dispatch<SetStateAction<boolean>>
  setReportVersion: Dispatch<SetStateAction<number>>
}

export const useStartupSyncHydration = ({
  hydrateSavedPlans,
  setSavedPlansHydrated,
  setReportVersion,
}: UseStartupSyncHydrationOptions) => {
  const [startupSyncHydrationPhase, setStartupSyncHydrationPhase] =
    useState<StartupSyncHydrationPhase>('sync-bootstrap')
  const [startupSyncHydrationSource, setStartupSyncHydrationSource] =
    useState<StartupSyncHydrationSource>(null)
  const [startupSyncHydrationCompletedAt, setStartupSyncHydrationCompletedAt] =
    useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const initialReportsJson = JSON.stringify(readReports())

    const applyReports = (reports: ReturnType<typeof readReports>) => {
      if (cancelled) {
        return
      }
      if (JSON.stringify(reports) === initialReportsJson) {
        return
      }
      setReportVersion((value) => value + 1)
    }

    const hydrateFromFallback = async () => {
      if (!cancelled) {
        setStartupSyncHydrationPhase('local-fallback')
        setStartupSyncHydrationSource('local-fallback')
      }
      const [loadedPlans, loadedReports] = await Promise.all([
        loadSavedPlans(),
        loadReports(),
      ])
      hydrateSavedPlans(loadedPlans)
      applyReports(loadedReports)
    }

    void loadSyncBootstrapOnce()
      .then((snapshot) => {
        if (!snapshot) {
          return hydrateFromFallback()
        }

        if (!cancelled) {
          setStartupSyncHydrationSource('shared')
        }
        hydrateSavedPlans(snapshot.savedPlans)
        applyReports(snapshot.reports)
      })
      .catch(() => hydrateFromFallback())
      .finally(() => {
        if (!cancelled) {
          setStartupSyncHydrationPhase('ready')
          setStartupSyncHydrationCompletedAt(Date.now())
          setSavedPlansHydrated(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [hydrateSavedPlans, setReportVersion, setSavedPlansHydrated])

  return {
    startupSyncHydrationCompletedAt,
    startupSyncHydrationPhase,
    startupSyncHydrationSource,
  }
}
