import { useEffect, useState } from 'react'
import {
  parsePaidCurbReferencePack,
  type PaidCurbReferenceDistrict,
} from '../data/paidCurbReference'
import type { RuntimeCoverageReferenceData } from '../data/coverageCatalog'

export type PaidCurbReferenceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'

export interface PaidCurbReferenceState {
  status: PaidCurbReferenceStatus
  district: PaidCurbReferenceDistrict | null
  sourceUrl: string | null
  error: string | null
}

const IDLE_STATE: PaidCurbReferenceState = {
  status: 'idle',
  district: null,
  sourceUrl: null,
  error: null,
}

export const loadPaidCurbReferenceDistrict = async (params: {
  districtId: string
  referenceData: RuntimeCoverageReferenceData
  signal?: AbortSignal
}) => {
  const response = await fetch(params.referenceData.url, {
    signal: params.signal,
  })
  if (!response.ok) {
    throw new Error(`Paid-curb reference request failed (${response.status})`)
  }
  const pack = parsePaidCurbReferencePack(await response.json())
  if (pack.source.sha256 !== params.referenceData.sourceSha256) {
    throw new Error('Paid-curb reference source hash does not match coverage catalog')
  }
  const district = pack.districts.find(
    (candidate) => candidate.districtId === params.districtId,
  )
  if (!district) {
    throw new Error(`Paid-curb reference district ${params.districtId} is missing`)
  }
  if (district.recordCount !== params.referenceData.recordCount) {
    throw new Error('Paid-curb reference record count does not match coverage catalog')
  }
  return district
}

export const usePaidCurbReferenceState = (params: {
  districtId: string | null
  referenceData: RuntimeCoverageReferenceData | null
}): PaidCurbReferenceState => {
  const [resolvedState, setResolvedState] = useState<
    PaidCurbReferenceState & { requestKey: string | null }
  >({ ...IDLE_STATE, requestKey: null })
  const url = params.referenceData?.url ?? null
  const sourceSha256 = params.referenceData?.sourceSha256 ?? null
  const recordCount = params.referenceData?.recordCount ?? null
  const requestKey =
    params.districtId && url && sourceSha256 && recordCount !== null
      ? [params.districtId, url, sourceSha256, recordCount].join('|')
      : null

  useEffect(() => {
    if (
      !requestKey ||
      !params.districtId ||
      !url ||
      !sourceSha256 ||
      recordCount === null
    ) {
      return
    }

    const controller = new AbortController()
    const referenceData: RuntimeCoverageReferenceData = {
      kind: 'PAID_CURB_SEGMENT_TEXT',
      url,
      recordCount,
      sourceSha256,
      geometryAvailable: false,
      legalAnswerEligible: false,
      requiresHumanReview: true,
    }
    loadPaidCurbReferenceDistrict({
      districtId: params.districtId,
      referenceData,
      signal: controller.signal,
    })
      .then((district) =>
        setResolvedState({
          status: 'ready',
          district,
          sourceUrl: url,
          error: null,
          requestKey,
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        setResolvedState({
          status: 'error',
          district: null,
          sourceUrl: url,
          error:
            error instanceof Error
              ? error.message
              : 'Paid-curb reference data could not be loaded',
          requestKey,
        })
      })

    return () => controller.abort()
  }, [params.districtId, recordCount, requestKey, sourceSha256, url])

  if (!requestKey) {
    return IDLE_STATE
  }
  if (resolvedState.requestKey !== requestKey) {
    return {
      status: 'loading',
      district: null,
      sourceUrl: url,
      error: null,
    }
  }
  return {
    status: resolvedState.status,
    district: resolvedState.district,
    sourceUrl: resolvedState.sourceUrl,
    error: resolvedState.error,
  }
}
