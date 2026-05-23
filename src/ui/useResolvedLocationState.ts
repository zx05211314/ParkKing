import { useEffect, useState } from 'react'
import { getBrowserLocation } from '../map/geo'
import {
  buildResolvedLocationState,
  getInitialResolvedLocationState,
  type ResolvedLocationState,
  type ResolvedLocationStatus,
} from './resolvedLocationState'

interface UseResolvedLocationStateOptions {
  useMockLocation: boolean
}

interface UseResolvedLocationStateResult {
  userLocation: [number, number] | null
  locationLabel: string
  locationStatus: ResolvedLocationStatus
}

export const useResolvedLocationState = ({
  useMockLocation,
}: UseResolvedLocationStateOptions): UseResolvedLocationStateResult => {
  const [resolvedLocationState, setResolvedLocationState] =
    useState<ResolvedLocationState>(() =>
      getInitialResolvedLocationState(useMockLocation),
    )

  useEffect(() => {
    setResolvedLocationState(getInitialResolvedLocationState(useMockLocation))
  }, [useMockLocation])

  useEffect(() => {
    let isActive = true

    const resolveLocation = async () => {
      if (useMockLocation) {
        if (!isActive) {
          return
        }
        setResolvedLocationState(
          buildResolvedLocationState({
            useMockLocation: true,
            deviceLocation: null,
          }),
        )
        return
      }

      const location = await getBrowserLocation()
      if (!isActive) {
        return
      }

      setResolvedLocationState(
        buildResolvedLocationState({
          useMockLocation: false,
          deviceLocation: location,
        }),
      )
    }

    resolveLocation()

    return () => {
      isActive = false
    }
  }, [useMockLocation])

  return {
    userLocation: resolvedLocationState.userLocation,
    locationLabel: resolvedLocationState.locationLabel,
    locationStatus: resolvedLocationState.locationStatus,
  }
}
