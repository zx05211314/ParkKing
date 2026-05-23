import { useEffect, useState } from 'react'
import type { ParkingAnswer } from '../domain/answers/parkingAnswer'
import type { RiskMode } from '../domain/ranking/rank'
import {
  checkParkingAnswerReadiness,
  getParkingAnswerApiRuntimeAvailability,
  ParkingAnswerReadinessError,
  searchParkingAnswer,
} from '../api/parkingAnswer'

export type ParkingAnswerServiceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'degraded'
  | 'error'
  | 'unavailable'

export interface ParkingAnswerServiceState {
  status: ParkingAnswerServiceStatus
  answer: ParkingAnswer | null
  error: string | null
}

interface UseParkingAnswerServiceStateOptions {
  districtId: string | null
  searchLocation: [number, number] | null
  nowHHMM: string
  includeInferred: boolean
  riskMode: RiskMode
}

const idleState: ParkingAnswerServiceState = {
  status: 'idle',
  answer: null,
  error: null,
}

interface ParkingAnswerServiceAsyncState {
  requestKey: string | null
  status: ParkingAnswerServiceStatus
  answer: ParkingAnswer | null
  error: string | null
}

const asyncIdleState: ParkingAnswerServiceAsyncState = {
  requestKey: null,
  status: 'idle',
  answer: null,
  error: null,
}

const buildRequestKey = ({
  districtId,
  searchLocation,
  nowHHMM,
  includeInferred,
  riskMode,
}: UseParkingAnswerServiceStateOptions) =>
  districtId && searchLocation
    ? [
        districtId,
        searchLocation[0],
        searchLocation[1],
        nowHHMM,
        includeInferred ? 'inferred' : 'official',
        riskMode,
      ].join('|')
    : null

export const useParkingAnswerServiceState = ({
  districtId,
  searchLocation,
  nowHHMM,
  includeInferred,
  riskMode,
}: UseParkingAnswerServiceStateOptions): ParkingAnswerServiceState => {
  const [asyncState, setAsyncState] =
    useState<ParkingAnswerServiceAsyncState>(asyncIdleState)
  const availability = getParkingAnswerApiRuntimeAvailability()
  const requestKey = buildRequestKey({
    districtId,
    searchLocation,
    nowHHMM,
    includeInferred,
    riskMode,
  })

  useEffect(() => {
    if (!districtId || !searchLocation || !requestKey || !availability.available) {
      return
    }

    const controller = new AbortController()

    void checkParkingAnswerReadiness({ signal: controller.signal })
      .then(() =>
        searchParkingAnswer(
          {
            district: districtId,
            location: searchLocation,
            hhmm: nowHHMM,
            includeInferred,
            riskMode,
          },
          {
            signal: controller.signal,
          },
        ),
      )
      .then((result) => {
        setAsyncState({
          requestKey,
          status: 'ready',
          answer: result.answer,
          error: null,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return
        }
        setAsyncState({
          requestKey,
          status: error instanceof ParkingAnswerReadinessError ? 'degraded' : 'error',
          answer: null,
          error:
            error instanceof Error
              ? error.message
              : 'Parking answer API unavailable.',
        })
      })

    return () => {
      controller.abort()
    }
  }, [
    availability.available,
    districtId,
    includeInferred,
    nowHHMM,
    requestKey,
    riskMode,
    searchLocation,
  ])

  if (!districtId || !searchLocation || !requestKey) {
    return idleState
  }

  if (!availability.available) {
    return {
      status: 'unavailable',
      answer: null,
      error: availability.message,
    }
  }

  if (asyncState.requestKey !== requestKey) {
    return {
      status: 'loading',
      answer: null,
      error: null,
    }
  }

  if (asyncState.error) {
    return {
      status: asyncState.status === 'degraded' ? 'degraded' : 'error',
      answer: null,
      error: asyncState.error,
    }
  }

  return {
    status: 'ready',
    answer: asyncState.answer,
    error: null,
  }
}
