import { useEffect, useState } from 'react'
import {
  parsePaidCurbReferencePack,
  type PaidCurbReferenceDistrict,
} from '../data/paidCurbReference'
import {
  parsePaidCurbSpatialReferencePack,
  type PaidCurbSpatialReferencePack,
} from '../data/paidCurbSpatialReference'
import type { RuntimeCoverageReferenceData } from '../data/coverageCatalog'

export type PaidCurbReferenceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'

export interface PaidCurbReferenceState {
  status: PaidCurbReferenceStatus
  district: PaidCurbReferenceDistrict | null
  spatialReference: PaidCurbSpatialReferencePack | null
  sourceUrl: string | null
  spatialSourceUrl: string | null
  error: string | null
}

const IDLE_STATE: PaidCurbReferenceState = {
  status: 'idle',
  district: null,
  spatialReference: null,
  sourceUrl: null,
  spatialSourceUrl: null,
  error: null,
}

const decodeCanonicalText = (buffer: ArrayBuffer) =>
  new TextDecoder().decode(buffer).replace(/\r\n?/g, '\n')

const sha256CanonicalText = async (text: string) => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto unavailable for paid-curb spatial verification')
  }
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const loadPaidCurbSpatialReference = async (params: {
  districtId: string
  spatialReference: NonNullable<
    RuntimeCoverageReferenceData['spatialReference']
  >
  signal?: AbortSignal
}) => {
  const response = await fetch(params.spatialReference.url, {
    signal: params.signal,
  })
  if (!response.ok) {
    throw new Error(
      `Paid-curb spatial reference request failed (${response.status})`,
    )
  }
  const buffer = await response.arrayBuffer()
  const canonicalText = decodeCanonicalText(buffer)
  if (
    (await sha256CanonicalText(canonicalText)) !==
    params.spatialReference.dataSha256
  ) {
    throw new Error('Paid-curb spatial reference data hash does not match catalog')
  }
  const pack = parsePaidCurbSpatialReferencePack(
    JSON.parse(canonicalText) as unknown,
  )
  const metadata = pack.metadata
  const comparisons: Array<[string, unknown, unknown]> = [
    ['districtId', metadata.districtId, params.districtId],
    [
      'sourceSha256',
      metadata.sourceSha256,
      params.spatialReference.sourceSha256,
    ],
    [
      'reviewSha256',
      metadata.reviewSha256,
      params.spatialReference.reviewSha256,
    ],
    [
      'featureCount',
      metadata.featureCount,
      params.spatialReference.featureCount,
    ],
    [
      'excludedFeatureCount',
      metadata.excludedFeatureCount,
      params.spatialReference.excludedFeatureCount,
    ],
    [
      'geometryPrecision',
      metadata.geometryPrecision,
      params.spatialReference.geometryPrecision,
    ],
    ['legalAnswerEligible', metadata.legalAnswerEligible, false],
  ]
  const mismatch = comparisons.find(([, actual, expected]) => actual !== expected)
  if (mismatch) {
    throw new Error(
      `Paid-curb spatial reference ${mismatch[0]} does not match coverage catalog`,
    )
  }
  return pack
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
  const spatialReference = params.referenceData?.spatialReference ?? null
  const spatialRequestKey = spatialReference
    ? [
        spatialReference.url,
        spatialReference.dataSha256,
        spatialReference.sourceSha256,
        spatialReference.reviewSha256,
        spatialReference.featureCount,
        spatialReference.excludedFeatureCount,
      ].join('|')
    : ''
  const requestKey =
    params.districtId && url && sourceSha256 && recordCount !== null
      ? [
          params.districtId,
          url,
          sourceSha256,
          recordCount,
          spatialRequestKey,
        ].join('|')
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
      ...(spatialReference ? { spatialReference } : {}),
    }
    Promise.all([
      loadPaidCurbReferenceDistrict({
        districtId: params.districtId,
        referenceData,
        signal: controller.signal,
      }),
      spatialReference
        ? loadPaidCurbSpatialReference({
            districtId: params.districtId,
            spatialReference,
            signal: controller.signal,
          })
        : Promise.resolve(null),
    ])
      .then(([district, loadedSpatialReference]) =>
        setResolvedState({
          status: 'ready',
          district,
          spatialReference: loadedSpatialReference,
          sourceUrl: url,
          spatialSourceUrl: spatialReference?.url ?? null,
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
          spatialReference: null,
          sourceUrl: url,
          spatialSourceUrl: spatialReference?.url ?? null,
          error:
            error instanceof Error
              ? error.message
              : 'Paid-curb reference data could not be loaded',
          requestKey,
        })
      })

    return () => controller.abort()
  }, [
    params.districtId,
    recordCount,
    requestKey,
    sourceSha256,
    spatialReference,
    url,
  ])

  if (!requestKey) {
    return IDLE_STATE
  }
  if (resolvedState.requestKey !== requestKey) {
    return {
      status: 'loading',
      district: null,
      spatialReference: null,
      sourceUrl: url,
      spatialSourceUrl: spatialReference?.url ?? null,
      error: null,
    }
  }
  return {
    status: resolvedState.status,
    district: resolvedState.district,
    spatialReference: resolvedState.spatialReference,
    sourceUrl: resolvedState.sourceUrl,
    spatialSourceUrl: resolvedState.spatialSourceUrl,
    error: resolvedState.error,
  }
}
