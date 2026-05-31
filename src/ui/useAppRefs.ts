import { useRef } from 'react'

interface UseAppRefsOptions {
  nowHHMM: string
  datasetId: string | null
  zoneParamsVersion: string | number
}

export const useAppRefs = ({
  nowHHMM,
  datasetId,
  zoneParamsVersion,
}: UseAppRefsOptions) => {
  const mapPrefetchRef = useRef(false)
  const geocodeRequestIdRef = useRef(0)
  const routeRequestIdRef = useRef(0)
  const selectedRouteRequestIdRef = useRef(0)
  const selectedRouteEtaRequestIdRef = useRef(0)
  const cameraRequestIdRef = useRef(0)
  const filterInputRef = useRef<HTMLInputElement | null>(null)
  const addressInputRef = useRef<HTMLInputElement | null>(null)
  const savedPlanImportRef = useRef<HTMLInputElement | null>(null)
  const nowHHMMRef = useRef(nowHHMM)
  const datasetHashRef = useRef<string | null>(null)
  const datasetIdRef = useRef(datasetId)
  const zoneParamsVersionRef = useRef(zoneParamsVersion)

  return {
    mapPrefetchRef,
    geocodeRequestIdRef,
    routeRequestIdRef,
    selectedRouteRequestIdRef,
    selectedRouteEtaRequestIdRef,
    cameraRequestIdRef,
    filterInputRef,
    addressInputRef,
    savedPlanImportRef,
    nowHHMMRef,
    datasetHashRef,
    datasetIdRef,
    zoneParamsVersionRef,
  }
}
