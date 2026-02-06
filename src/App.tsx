import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, LineString, MultiLineString, Point } from 'geojson'
import './App.css'
import { distanceMeters, getBrowserLocation, getPathMidpoint, MOCK_LOCATION } from './map/geo'
import {
  clearClipCache,
  getClipCacheStats,
  resetClipCacheStats,
  type ClipCacheStats,
} from './domain/geometry/clipCache'
import { evaluateSegmentWithZones } from './domain/rules/evaluateSegment'
import { getCurrentHHMM, getDemoHHMM, type TimeMode } from './domain/rules/time'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from './domain/zones/makeZones'
import { ZoneType, type Zone } from './domain/zones/zoneTypes'
import { clearZoneIndexCache, getZoneIndex, type ZoneIndex } from './domain/zones/zoneIndex'
import { SegmentList, type SegmentListItem } from './ui/SegmentList'
import { SegmentSheet } from './ui/SegmentSheet'
import { MapErrorBoundary } from './ui/MapErrorBoundary'
import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
  type DatasetMeta,
} from './data/segmentBuilder'
import { getDataBaseUrl, getDatasetBaseDir, getDatasetRootDir } from './data/datasetResolver'
import { selectDistrictByLocation } from './data/districtSelect'
import { loadGeoJson } from './data/loaders/loadGeoJson'
import { loadText } from './data/loaders/loadText.browser'
import {
  DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS,
  XINYI_CENTER,
} from './data/constants'
import {
  readSetting,
  STORAGE_KEYS,
  writeSetting,
  SETTINGS_SCHEMA_VERSION,
} from './settings'
import type { EvaluatedSegment, Segment } from './ui/types'
import { applyRankingPolicy, type RiskMode } from './domain/ranking/policy'
import { getRankBreakdown } from './domain/ranking/rank'
import {
  validateFileSet,
  validateMeta,
  validateRegistryEntry,
  type RegistryEntry,
  verifyPackHashes,
  verifyMetaSha256,
} from './data/districtPack'
import { EvaluationWorkerClient } from './workers/evaluationClient'
import {
  buildDatasetInfoModel,
  type LatestPointer,
  type DatasetManifest,
  type IngestReport,
} from './ui/datasetInfo/model'
import {
  appendReport,
  getLatestReports,
  getLatestReportsBySegment,
  normalizeReportSegmentId,
  readReports,
  type ReportStatus,
  type SegmentReport,
} from './feedback/reports'

const DatasetInfoSheet = lazy(() =>
  import('./ui/DatasetInfoSheet').then((module) => ({
    default: module.DatasetInfoSheet,
  })),
)

const preloadMapView = () => import('./map/MapView')

type RankedSegment = EvaluatedSegment & { distanceMeters?: number; rankScore?: number }

const DEFAULT_RADIUS_METERS = 600
const DEFAULT_RISK_MODE: RiskMode = 'NEUTRAL'

const RISK_MODE_LABELS: Record<RiskMode, string> = {
  CONSERVATIVE: 'Conservative',
  NEUTRAL: 'Neutral',
  AGGRESSIVE: 'Aggressive',
}

const isRiskMode = (value: unknown): value is RiskMode => {
  return value === 'CONSERVATIVE' || value === 'NEUTRAL' || value === 'AGGRESSIVE'
}

const DATASET_FILES = {
  redYellow: 'red_yellow.geojson',
  busStops: 'bus_stops.geojson',
  hydrants: 'hydrants.geojson',
  intersections: 'intersections.geojson',
  crosswalks: 'crosswalks.geojson',
  signOverrides: 'sign_overrides.geojson',
  inferredCandidates: 'candidates_inferred.geojson',
  meta: 'dataset_meta.json',
}

const USE_WORKER = true

const FALLBACK_DATASET_OPTIONS = [
  { id: 'xinyi', label: 'Xinyi' },
  { id: 'daan', label: 'Daan' },
]

const formatMetaDate = (value?: string) => {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }
  return parsed.toLocaleString()
}

const MapSkeleton = () => (
  <div className="map-skeleton">
    <div className="map-skeleton-title">Loading map?</div>
    <div className="map-skeleton-grid">
      <div className="map-skeleton-block" />
      <div className="map-skeleton-block" />
      <div className="map-skeleton-block" />
    </div>
  </div>
)

function App() {
  const [mode, setMode] = useState<TimeMode>('NOW')
  const [nowHHMM, setNowHHMM] = useState(getCurrentHHMM())
  const [datasetOptions, setDatasetOptions] = useState(FALLBACK_DATASET_OPTIONS)
  const [datasetId, setDatasetId] = useState<string | null>(() => {
    const stored = readSetting<string | null>(STORAGE_KEYS.datasetId, null)
    return stored && stored.length > 0 ? stored : null
  })
  const hasStoredDatasetIdRef = useRef(datasetId !== null)
  const [activeView, setActiveView] = useState<'LIST' | 'MAP'>('LIST')
  const [mapRetryKey, setMapRetryKey] = useState(0)
  const [radiusMeters, setRadiusMeters] = useState(() =>
    readSetting<number>(STORAGE_KEYS.radiusMeters, DEFAULT_RADIUS_METERS),
  )
  const [riskMode, setRiskMode] = useState<RiskMode>(() => {
    const stored = readSetting<unknown>(STORAGE_KEYS.riskMode, DEFAULT_RISK_MODE)
    return isRiskMode(stored) ? stored : DEFAULT_RISK_MODE
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [useMockLocation, setUseMockLocation] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.useMockLocation, true),
  )
  const [userLocation, setUserLocation] = useState<[number, number] | null>(() =>
    readSetting<boolean>(STORAGE_KEYS.useMockLocation, true) ? MOCK_LOCATION : null,
  )
  const [locationLabel, setLocationLabel] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.useMockLocation, true) ? 'Mock' : 'Device',
  )
  const [showZones, setShowZones] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showZones, false),
  )
  const [showIntersectionZones, setShowIntersectionZones] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showIntersectionZones, false),
  )
  const [showCrosswalkZones, setShowCrosswalkZones] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showCrosswalkZones, false),
  )
  const [showInferredCandidates, setShowInferredCandidates] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.showInferredCandidates, false),
  )
  const [includeInferred, setIncludeInferred] = useState(() =>
    readSetting<boolean>(STORAGE_KEYS.includeInferred, false),
  )
  const [segments, setSegments] = useState<Segment[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [intersectionCount, setIntersectionCount] = useState(0)
  const [crosswalkCount, setCrosswalkCount] = useState(0)
  const [overrideCount, setOverrideCount] = useState(0)
  const [inferredCount, setInferredCount] = useState(0)
  const [datasetMeta, setDatasetMeta] = useState<DatasetMeta | null>(null)
  const [datasetStatus, setDatasetStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [packError, setPackError] = useState<string | null>(null)
  const [evaluationStatus, setEvaluationStatus] = useState<
    'idle' | 'working' | 'ready' | 'error'
  >('idle')
  const [clipCacheStats, setClipCacheStats] = useState<ClipCacheStats | null>(null)
  const [evaluatedSegments, setEvaluatedSegments] = useState<EvaluatedSegment[]>(
    [],
  )
  const [latestInfo, setLatestInfo] = useState<LatestPointer | null>(null)
  const [manifestInfo, setManifestInfo] = useState<DatasetManifest | null>(null)
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [reportVersion, setReportVersion] = useState(0)

  const dataBaseUrl = getDataBaseUrl()
  const dataSourceLabel = dataBaseUrl ? `Remote (${dataBaseUrl})` : 'Local'

  const workerClientRef = useRef<EvaluationWorkerClient | null>(null)
  const mapPrefetchRef = useRef(false)
  const nowHHMMRef = useRef(nowHHMM)
  const datasetHashRef = useRef<string | null>(null)
  const datasetIdRef = useRef(datasetId)
  const zoneParamsVersionRef = useRef(ZONE_PARAMS_VERSION)

  const datasetHash = datasetMeta?.datasetHash ?? 'local'
  const districtName = datasetMeta?.districtName ?? datasetId ?? 'Unknown'
  const schemaVersion = datasetMeta?.schemaVersion ?? '-'
  const mapCenter = datasetMeta?.boundaryCenter ?? XINYI_CENTER
  const reportsBySegment = useMemo<Record<string, SegmentReport>>(() => {
    void reportVersion
    if (!datasetId) {
      return {}
    }
    return getLatestReportsBySegment(readReports(), datasetId)
  }, [datasetId, reportVersion])
  const MapViewLazy = useMemo(
    () => {
      void mapRetryKey
      return lazy(() =>
        preloadMapView().then((module) => ({
          default: module.MapView,
        })),
      )
    },
    [mapRetryKey],
  )
  const zoneIndex = useMemo<ZoneIndex | null>(() => {
    if (zones.length === 0) {
      return null
    }
    return getZoneIndex(zones, datasetHash, ZONE_PARAMS_VERSION)
  }, [zones, datasetHash])

  const intersectionZones = useMemo(
    () => zones.filter((zone) => zone.type === ZoneType.INTERSECTION_BUFFER),
    [zones],
  )
  const crosswalkZones = useMemo(
    () => zones.filter((zone) => zone.type === ZoneType.CROSSWALK_BUFFER),
    [zones],
  )
  const regularZones = useMemo(
    () =>
      zones.filter(
        (zone) =>
          zone.type !== ZoneType.INTERSECTION_BUFFER &&
          zone.type !== ZoneType.CROSSWALK_BUFFER,
      ),
    [zones],
  )

  useEffect(() => {
    nowHHMMRef.current = nowHHMM
  }, [nowHHMM])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (mapPrefetchRef.current) {
      return
    }
    const { requestIdleCallback, cancelIdleCallback } = window as Window & {
      requestIdleCallback?: (callback: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    const schedule =
      requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1200))
    const cancel =
      cancelIdleCallback ?? ((id: number) => window.clearTimeout(id))

    const idleId = schedule(() => {
      if (mapPrefetchRef.current) {
        return
      }
      mapPrefetchRef.current = true
      preloadMapView().catch(() => {})
    })

    return () => {
      cancel(idleId)
    }
  }, [])

  useEffect(() => {
    writeSetting(STORAGE_KEYS.settingsSchemaVersion, SETTINGS_SCHEMA_VERSION)
    writeSetting(STORAGE_KEYS.datasetId, datasetId)
    writeSetting(STORAGE_KEYS.radiusMeters, radiusMeters)
    writeSetting(STORAGE_KEYS.riskMode, riskMode)
    writeSetting(STORAGE_KEYS.includeInferred, includeInferred)
    writeSetting(STORAGE_KEYS.showZones, showZones)
    writeSetting(STORAGE_KEYS.showIntersectionZones, showIntersectionZones)
    writeSetting(STORAGE_KEYS.showCrosswalkZones, showCrosswalkZones)
    writeSetting(STORAGE_KEYS.showInferredCandidates, showInferredCandidates)
    writeSetting(STORAGE_KEYS.useMockLocation, useMockLocation)
  }, [
    datasetId,
    radiusMeters,
    riskMode,
    includeInferred,
    showZones,
    showIntersectionZones,
    showCrosswalkZones,
    showInferredCandidates,
    useMockLocation,
  ])

  useEffect(() => {
    const datasetChanged =
      datasetHashRef.current && datasetHashRef.current !== datasetHash
    const datasetIdChanged = datasetIdRef.current !== datasetId
    const paramsChanged = zoneParamsVersionRef.current !== ZONE_PARAMS_VERSION

    if (datasetChanged || datasetIdChanged || paramsChanged) {
      workerClientRef.current?.terminate()
      workerClientRef.current = null
      clearClipCache()
      clearZoneIndexCache()
      resetClipCacheStats()
      setClipCacheStats(getClipCacheStats())
      setEvaluatedSegments([])
      setEvaluationStatus('idle')
    }
    datasetHashRef.current = datasetHash
    datasetIdRef.current = datasetId
    zoneParamsVersionRef.current = ZONE_PARAMS_VERSION
  }, [datasetHash, datasetId])

  useEffect(() => {
    let isActive = true

    const loadRegistry = async () => {
      if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return
      }
      const rootDir = getDatasetRootDir().replace(/[\\/]+$/g, '')
      const candidates = [`${rootDir}/registry.json`]

      for (const url of candidates) {
        try {
          const response = await fetch(url)
          if (!response.ok) {
            continue
          }
          const payload = (await response.json()) as {
            districts?: RegistryEntry[]
          }
          const entries = payload.districts ?? []
          const verifyHashes =
            (import.meta as { env?: Record<string, string> }).env?.VITE_VERIFY_HASHES ===
            '1'
          const validEntries: typeof entries = []
          for (const entry of entries) {
            const validation = validateRegistryEntry(entry)
            if (!validation.valid) {
              continue
            }
            if (verifyHashes) {
              const baseDir = getDatasetBaseDir(entry.districtId)
              const metaCheck = await verifyMetaSha256(baseDir, entry.metaSha256)
              if (!metaCheck.valid) {
                continue
              }
            }
            validEntries.push(entry)
          }
          if (validEntries.length > 0 && isActive) {
            const options = validEntries.map((entry) => ({
              id: entry.districtId,
              label: entry.districtName,
            }))
            setDatasetOptions(options)
            if (datasetId && !options.find((option) => option.id === datasetId)) {
              setDatasetId(options[0]?.id ?? datasetId)
            }
          }
          return
        } catch {
          continue
        }
      }
    }

    loadRegistry()

    const loadData = async () => {
      setDatasetStatus('loading')
      setSelectedId(null)
      setSegments([])
      setZones([])
        setIntersectionCount(0)
        setCrosswalkCount(0)
        setOverrideCount(0)
        setInferredCount(0)
        setDatasetMeta(null)
        setLatestInfo(null)
        setManifestInfo(null)
        setIngestReport(null)
        setMetricsHistory(null)
        setPackError(null)

      if (!datasetId) {
        return
      }

      try {
        const fileCheck = await validateFileSet(datasetId)
        if (!fileCheck.valid) {
          throw new Error(fileCheck.errors.join('\n'))
        }

        const baseDir = getDatasetBaseDir(datasetId)
        const [
          redYellow,
          busStops,
          hydrants,
          intersections,
          crosswalks,
          signOverrides,
          inferredCandidates,
          meta,
        ] = await Promise.all([
          loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
            DATASET_FILES.redYellow,
            { baseDir },
          ),
          loadGeoJson<FeatureCollection<Point>>(DATASET_FILES.busStops, { baseDir }),
          loadGeoJson<FeatureCollection<Point>>(DATASET_FILES.hydrants, { baseDir }),
          loadGeoJson<FeatureCollection<Point>>(DATASET_FILES.intersections, { baseDir }),
          loadGeoJson<FeatureCollection>(DATASET_FILES.crosswalks, { baseDir }).catch(
            () => ({ type: 'FeatureCollection', features: [] } as FeatureCollection),
          ),
          loadGeoJson<FeatureCollection>(DATASET_FILES.signOverrides, { baseDir }).catch(
            () => ({ type: 'FeatureCollection', features: [] } as FeatureCollection),
          ),
          loadGeoJson<FeatureCollection<LineString | MultiLineString>>(
            DATASET_FILES.inferredCandidates,
            { baseDir },
          ).catch(
            () =>
              ({
                type: 'FeatureCollection',
                features: [],
              } as FeatureCollection<LineString | MultiLineString>),
          ),
          loadGeoJson<DatasetMeta>(DATASET_FILES.meta, { baseDir }).catch(() => null),
        ])

        if (!isActive) {
          return
        }

        if (!meta) {
          throw new Error('dataset_meta.json missing or unreadable')
        }
        const metaCheck = validateMeta(meta)
        if (!metaCheck.valid) {
          throw new Error(metaCheck.errors.join('\n'))
        }

        const verifyHashes =
          (import.meta as { env?: Record<string, string> }).env?.VITE_VERIFY_HASHES ===
          '1'
        if (verifyHashes && meta.files) {
          const hashCheck = await verifyPackHashes(baseDir, meta.files)
          if (!hashCheck.valid) {
            throw new Error(`Pack integrity failure:\n${hashCheck.errors.join('\n')}`)
          }
        }

        if (verifyHashes) {
          try {
            const latest = await loadGeoJson<{
              datasetHash: string
              publishedAt: string
            }>('LATEST.json', { baseDir })
            if (latest?.datasetHash && latest.datasetHash !== meta.datasetHash) {
              throw new Error(
                `Pack out of sync: meta ${meta.datasetHash} vs LATEST ${latest.datasetHash}`,
              )
            }
          } catch {
            // Missing LATEST.json is acceptable.
          }
        }

        const latest = await loadGeoJson<LatestPointer>('LATEST.json', {
          baseDir,
        }).catch(() => null)
        setLatestInfo(latest)

        const rootBase = baseDir.replace(/\/+$/g, '')
        const rootDir = rootBase.endsWith(`/${datasetId}`)
          ? rootBase.slice(0, -(`/${datasetId}`).length)
          : rootBase
        const manifestPath = latest?.manifestPath
          ? latest.manifestPath.replace(/^\/+/, '')
          : null

        if (manifestPath) {
          const manifest = await loadGeoJson<DatasetManifest>(manifestPath, {
            baseDir: rootDir,
          }).catch(() => null)
          setManifestInfo(manifest)
        } else {
          setManifestInfo(null)
        }

        const report = await loadGeoJson<IngestReport>('ingest_all_report.json', {
          baseDir: rootDir,
        }).catch(() => null)
        setIngestReport(report)

        let history = await loadText('metrics_history.jsonl', {
          baseDir,
        }).catch(() => null)
        if (!history && rootDir && rootDir !== baseDir) {
          const legacyHistory = await loadText('metrics_history.jsonl', {
            baseDir: rootDir,
          }).catch(() => null)
          if (legacyHistory) {
            console.warn('metrics_history.jsonl loaded from pack root (legacy).')
            history = legacyHistory
          }
        }
        setMetricsHistory(history)

        const builtSegments = redYellow.features.flatMap((feature, index) =>
          buildSegmentsFromFeature(feature, index, meta),
        )
        const inferredSegments = inferredCandidates.features.flatMap((feature, index) =>
          buildInferredSegmentsFromFeature(feature, index, meta),
        )

        const matchTolerance =
          meta?.signOverrideMatchToleranceMeters ??
          DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS
        const segmentsWithOverrides = applySignOverrides(builtSegments, signOverrides, {
          matchToleranceMeters: matchTolerance,
        })

        setSegments([...segmentsWithOverrides, ...inferredSegments])
        setZones(makeZonesFromPOIs(busStops, hydrants, intersections, crosswalks))
        setIntersectionCount(intersections.features.length)
        setCrosswalkCount(crosswalks.features.length)
        setOverrideCount(signOverrides.features.length)
        setInferredCount(inferredSegments.length)
        setDatasetMeta(meta)
        setDatasetStatus('ready')
      } catch (error) {
        console.error(error)
        if (isActive) {
          setPackError(error instanceof Error ? error.message : 'Invalid dataset pack')
          setDatasetStatus('error')
        }
      }
    }

    loadData()

    return () => {
      isActive = false
    }
  }, [datasetId])

  useEffect(() => {
    if (!USE_WORKER || segments.length === 0) {
      return
    }

    if (!workerClientRef.current) {
      const worker = new Worker(new URL('./workers/geoWorker.ts', import.meta.url), {
        type: 'module',
      })
      const client = new EvaluationWorkerClient(worker, {
        onInit: () => {
          setEvaluationStatus('working')
          client.evaluate(nowHHMMRef.current)
        },
        onEvaluated: (payload) => {
          setEvaluatedSegments(payload.segments)
          setClipCacheStats(payload.cacheStats ?? null)
          setEvaluationStatus('ready')
        },
        onError: () => {
          setEvaluationStatus('error')
        },
      })
      workerClientRef.current = client
    }

    workerClientRef.current.resetRequestId()
    setEvaluationStatus('working')
    workerClientRef.current.init({
      segments,
      zones,
      datasetHash,
      zoneParamsVersion: ZONE_PARAMS_VERSION,
    })
  }, [segments, zones, datasetHash])

  useEffect(() => {
    if (!USE_WORKER) {
      return
    }
    const client = workerClientRef.current
    if (!client || !client.isReady()) {
      return
    }
    setEvaluationStatus('working')
    client.evaluate(nowHHMM)
  }, [nowHHMM])

  useEffect(() => {
    if (USE_WORKER && evaluationStatus !== 'error') {
      return
    }

    if (!segments.length) {
      setEvaluatedSegments([])
      setEvaluationStatus('idle')
      return
    }

    const fallback = segments.flatMap((segment) =>
      evaluateSegmentWithZones(segment, nowHHMM, zoneIndex),
    )
    setEvaluatedSegments(fallback)
    setClipCacheStats(getClipCacheStats())
    setEvaluationStatus('ready')
  }, [segments, nowHHMM, zoneIndex, evaluationStatus])

  useEffect(() => {
    return () => {
      workerClientRef.current?.terminate()
      workerClientRef.current = null
    }
  }, [])

  const segmentsWithDistance = useMemo(() => {
    const withDistance: SegmentListItem[] = evaluatedSegments.map((segment) => ({
      ...segment,
      distanceMeters: userLocation
        ? distanceMeters(userLocation, getPathMidpoint(segment.path))
        : undefined,
    }))

    return applyRankingPolicy(withDistance, {
      includeInferred,
      radiusMeters,
      riskMode,
    })
  }, [evaluatedSegments, userLocation, includeInferred, radiusMeters, riskMode])

  const selectedSegment = useMemo(() => {
    if (!selectedId) {
      return null
    }
    const rankedMatch = segmentsWithDistance.find(
      (segment) => segment.id === selectedId,
    )
    if (rankedMatch) {
      return rankedMatch as RankedSegment
    }
    return evaluatedSegments.find((segment) => segment.id === selectedId) ?? null
  }, [segmentsWithDistance, evaluatedSegments, selectedId])

  const latestReport = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    return (
      reportsBySegment[normalizeReportSegmentId(selectedSegment.id)] ?? null
    )
  }, [reportsBySegment, selectedSegment])

  const selectedDistance = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    const candidate = (selectedSegment as RankedSegment).distanceMeters
    if (candidate !== undefined) {
      return candidate
    }
    if (!userLocation) {
      return null
    }
    return distanceMeters(userLocation, getPathMidpoint(selectedSegment.path))
  }, [selectedSegment, userLocation])

  const selectedRankBreakdown = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    return getRankBreakdown(
      selectedSegment,
      selectedDistance ?? undefined,
      riskMode,
    )
  }, [selectedSegment, selectedDistance, riskMode])

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  const handleModeChange = (nextMode: TimeMode) => {
    setMode(nextMode)
    setNowHHMM(getDemoHHMM(nextMode))
  }

  const handleRadiusChange = (value: string) => {
    const next = Number(value)
    if (!Number.isFinite(next)) {
      return
    }
    const clamped = Math.max(100, Math.min(3000, Math.round(next)))
    setRadiusMeters(clamped)
  }

  const handleMapRetry = useCallback(() => {
    setMapRetryKey((value) => value + 1)
  }, [])

  const handleMapPrefetch = useCallback(() => {
    if (mapPrefetchRef.current) {
      return
    }
    mapPrefetchRef.current = true
    preloadMapView().catch(() => {})
  }, [])

  const handleSegmentReport = useCallback(
    (status: ReportStatus, note: string) => {
      if (!selectedSegment || !datasetId) {
        return
      }
      appendReport({
        districtId: datasetId,
        segmentId: selectedSegment.id,
        status,
        note,
      })
      setReportVersion((value) => value + 1)
    },
    [datasetId, selectedSegment],
  )

  const handleExportReports = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }
    const latest = getLatestReports(readReports())
    if (latest.length === 0) {
      return
    }
    const lines = latest.map((entry) => JSON.stringify(entry)).join('\n')
    const blob = new Blob([`${lines}\n`], { type: 'application/jsonl' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '')
    link.href = url
    link.download = `parkking-overrides-${timestamp}.jsonl`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }, [])

  const handleReportIssue = useCallback(async () => {
    const { buildDebugBundle, downloadDebugBundle } = await import(
      './ui/debug/exportDebugBundle'
    )
    const bundle = buildDebugBundle({
      meta: datasetMeta,
      hhmm: nowHHMM,
      includeInferred,
      selectedSegment,
      userLocation,
      zoneIndex,
    })
    downloadDebugBundle(bundle)
  }, [datasetMeta, nowHHMM, includeInferred, selectedSegment, userLocation, zoneIndex])

  useEffect(() => {
    let isActive = true

    if (useMockLocation) {
      setUserLocation(MOCK_LOCATION)
      setLocationLabel('Mock')
      return () => {
        isActive = false
      }
    }

    const resolveLocation = async () => {
      const location = await getBrowserLocation()
      if (!isActive) {
        return
      }
      if (location) {
        setUserLocation(location)
        setLocationLabel('Device')
      } else {
        setUserLocation(MOCK_LOCATION)
        setLocationLabel('Fallback')
      }
    }

    resolveLocation()

    return () => {
      isActive = false
    }
  }, [useMockLocation])

  useEffect(() => {
    if (hasStoredDatasetIdRef.current) {
      return
    }
    if (datasetId) {
      return
    }
    if (!userLocation || datasetOptions.length === 0) {
      return
    }

    let isActive = true

    const resolveDistrict = async () => {
      const boundaries = await Promise.all(
        datasetOptions.map(async (option) => {
          const baseDir = getDatasetBaseDir(option.id)
          const meta = await loadGeoJson<DatasetMeta>(DATASET_FILES.meta, {
            baseDir,
          }).catch(() => null)
          return {
            districtId: option.id,
            boundaryBBox: meta?.boundaryBBox ?? null,
            boundaryCenter: meta?.boundaryCenter ?? null,
          }
        }),
      )
      if (!isActive) {
        return
      }
      const selected = selectDistrictByLocation(boundaries, userLocation)
      if (selected) {
        setDatasetId(selected)
      } else if (datasetOptions[0]?.id) {
        setDatasetId(datasetOptions[0].id)
      }
    }

    resolveDistrict()

    return () => {
      isActive = false
    }
  }, [datasetId, datasetOptions, userLocation])

  return (
    <div className="app-shell">
      {packError ? (
        <div className="pack-error">
          <div className="pack-error-card">
            <div className="pack-error-title">Dataset pack error</div>
            <div className="pack-error-body">
              {packError.split('\n').map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
            <div className="pack-error-hint">
              Verify the dataset folder or rerun ingest for {datasetId}.
            </div>
          </div>
        </div>
      ) : null}
      <header className="app-header">
        <div className="app-title-block">
          <div className="app-title">Park King</div>
          <div className="app-subtitle">MVP-3 curb intelligence prototype</div>
        </div>
        <div className="header-controls">
          <div className="control-group">
            <div className="control-label">View</div>
            <div className="segmented">
              <button
                type="button"
                className={activeView === 'LIST' ? 'active' : ''}
                onClick={() => setActiveView('LIST')}
              >
                List
              </button>
              <button
                type="button"
                className={activeView === 'MAP' ? 'active' : ''}
                onClick={() => setActiveView('MAP')}
                onMouseEnter={handleMapPrefetch}
              >
                Map
              </button>
            </div>
            <div className="control-meta">
              Mode: {activeView === 'LIST' ? 'List only' : 'Map + list'}
            </div>
          </div>
          <div className="control-group">
            <div className="control-label">Dataset</div>
            <div className="control-input">
              <input
                list="dataset-options"
                value={datasetId ?? ''}
                onChange={(event) => {
                  const next = event.target.value.trim()
                  setDatasetId(next.length > 0 ? next : null)
                }}
              />
              <datalist id="dataset-options">
                {datasetOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="control-meta">Active: {datasetId ?? 'Auto'}</div>
          </div>
          <div className="control-group">
            <div className="control-label">Time mode</div>
            <div className="segmented">
              <button
                type="button"
                className={mode === 'NOW' ? 'active' : ''}
                onClick={() => handleModeChange('NOW')}
              >
                Now
              </button>
              <button
                type="button"
                className={mode === 'NIGHT' ? 'active' : ''}
                onClick={() => handleModeChange('NIGHT')}
              >
                Night
              </button>
            </div>
            <div className="control-meta">Eval time: {nowHHMM}</div>
          </div>
          <div className="control-group">
            <div className="control-label">Location</div>
            <div className="segmented">
              <button
                type="button"
                className={useMockLocation ? 'active' : ''}
                onClick={() => setUseMockLocation(true)}
              >
                Mock
              </button>
              <button
                type="button"
                className={!useMockLocation ? 'active' : ''}
                onClick={() => setUseMockLocation(false)}
              >
                Device
              </button>
            </div>
            <div className="control-meta">Source: {locationLabel}</div>
          </div>
          <div className="control-group">
            <div className="control-label">Radius (m)</div>
            <div className="control-input">
              <input
                type="number"
                min={100}
                max={3000}
                step={50}
                value={radiusMeters}
                onChange={(event) => handleRadiusChange(event.target.value)}
              />
            </div>
            <div className="control-meta">Cutoff: {radiusMeters} m</div>
          </div>
          <div className="control-group">
            <div className="control-label">Risk mode</div>
            <div className="segmented">
              <button
                type="button"
                className={riskMode === 'CONSERVATIVE' ? 'active' : ''}
                onClick={() => setRiskMode('CONSERVATIVE')}
              >
                Conservative
              </button>
              <button
                type="button"
                className={riskMode === 'NEUTRAL' ? 'active' : ''}
                onClick={() => setRiskMode('NEUTRAL')}
              >
                Neutral
              </button>
              <button
                type="button"
                className={riskMode === 'AGGRESSIVE' ? 'active' : ''}
                onClick={() => setRiskMode('AGGRESSIVE')}
              >
                Aggressive
              </button>
            </div>
            <div className="control-meta">
              Bias: {RISK_MODE_LABELS[riskMode]}
            </div>
          </div>
          <div className="control-group">
            <div className="control-label">Zones overlay</div>
            <div className="segmented">
              <button
                type="button"
                className={showZones ? 'active' : ''}
                onClick={() => setShowZones(true)}
              >
                Show
              </button>
              <button
                type="button"
                className={!showZones ? 'active' : ''}
                onClick={() => setShowZones(false)}
              >
                Hide
              </button>
            </div>
            <div className="control-meta">
              Overlay: {showZones ? 'On' : 'Off'}
            </div>
          </div>
          <div className="control-group">
            <div className="control-label">Intersection zones</div>
            <div className="segmented">
              <button
                type="button"
                className={showIntersectionZones ? 'active' : ''}
                onClick={() => setShowIntersectionZones(true)}
              >
                Show
              </button>
              <button
                type="button"
                className={!showIntersectionZones ? 'active' : ''}
                onClick={() => setShowIntersectionZones(false)}
              >
                Hide
              </button>
            </div>
            <div className="control-meta">
              Overlay: {showIntersectionZones ? 'On' : 'Off'}
            </div>
          </div>
          <div className="control-group">
            <div className="control-label">Crosswalk zones</div>
            <div className="segmented">
              <button
                type="button"
                className={showCrosswalkZones ? 'active' : ''}
                onClick={() => setShowCrosswalkZones(true)}
              >
                Show
              </button>
              <button
                type="button"
                className={!showCrosswalkZones ? 'active' : ''}
                onClick={() => setShowCrosswalkZones(false)}
              >
                Hide
              </button>
            </div>
            <div className="control-meta">
              Overlay: {showCrosswalkZones ? 'On' : 'Off'}
            </div>
          </div>
          <div className="control-group">
            <div className="control-label">Inferred candidates</div>
            <div className="segmented">
              <button
                type="button"
                className={showInferredCandidates ? 'active' : ''}
                onClick={() => setShowInferredCandidates(true)}
              >
                Show
              </button>
              <button
                type="button"
                className={!showInferredCandidates ? 'active' : ''}
                onClick={() => setShowInferredCandidates(false)}
              >
                Hide
              </button>
            </div>
            <div className="control-meta">
              Overlay: {showInferredCandidates ? 'On' : 'Off'}
            </div>
            <div className="segmented" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className={includeInferred ? 'active' : ''}
                onClick={() => setIncludeInferred(true)}
              >
                Include
              </button>
              <button
                type="button"
                className={!includeInferred ? 'active' : ''}
                onClick={() => setIncludeInferred(false)}
              >
                Exclude
              </button>
            </div>
            <div className="control-meta">
              List: {includeInferred ? 'Includes inferred' : 'Official only'}
            </div>
          </div>
          <div className="control-group">
            <div className="control-label">Dataset status</div>
            <div className="control-meta">District: {districtName}</div>
            <div className="control-meta">Schema: {schemaVersion}</div>
            <div className="control-meta">Segments: {segments.length}</div>
            <div className="control-meta">Inferred: {inferredCount}</div>
            <div className="control-meta">Overrides: {overrideCount}</div>
            <div className="control-meta">Zones: {zones.length}</div>
            <div className="control-meta">Intersections: {intersectionCount}</div>
            <div className="control-meta">Crosswalks: {crosswalkCount}</div>
            <div className="control-meta">Mode: {mode === 'NOW' ? 'Day' : 'Night'}</div>
            <div className="control-meta">
              Built: {formatMetaDate(datasetMeta?.generatedAt)}
            </div>
            <div className="control-meta">Eval: {evaluationStatus}</div>
            <div className="control-meta">
              Cache: {clipCacheStats
                ? `hits ${clipCacheStats.hits} | misses ${clipCacheStats.misses} | size ${clipCacheStats.size}`
                : '-'}
            </div>
            <div
              className={
                datasetStatus === 'error' ? 'control-meta status-error' : 'control-meta'
              }
            >
              Status: {datasetStatus}
            </div>
            <button
              type="button"
              className="sheet-close"
              style={{ marginTop: '8px' }}
              onClick={handleReportIssue}
            >
              Report issue
            </button>
            <button
              type="button"
              className="sheet-close"
              style={{ marginTop: '8px' }}
              onClick={handleExportReports}
            >
              Export reports
            </button>
            <button
              type="button"
              className="sheet-close"
              style={{ marginTop: '8px' }}
              onClick={() => setInfoOpen(true)}
            >
              Dataset Info
            </button>
          </div>
        </div>
      </header>

      <main
        className={activeView === 'LIST' ? 'app-main app-main-list' : 'app-main'}
      >
        {activeView === 'MAP' ? (
          <>
            <section className="map-panel">
              <MapErrorBoundary onRetry={handleMapRetry} resetKey={mapRetryKey}>
                <Suspense fallback={<MapSkeleton />}>
                  <MapViewLazy
                    center={mapCenter}
                    segments={evaluatedSegments}
                    zones={regularZones}
                    intersectionZones={intersectionZones}
                    showZones={showZones}
                    showIntersectionZones={showIntersectionZones}
                    crosswalkZones={crosswalkZones}
                    showCrosswalkZones={showCrosswalkZones}
                    showInferredCandidates={showInferredCandidates}
                    selectedId={selectedId}
                    userLocation={userLocation}
                    onSelect={handleSelect}
                  />
                </Suspense>
              </MapErrorBoundary>
              <div className="map-legend">
                <div>
                  <span className="legend-swatch green" /> Green: park ok
                </div>
                <div>
                  <span className="legend-swatch yellow" /> Yellow: caution
                </div>
                <div>
                  <span className="legend-swatch red" /> Red: no stop
                </div>
              </div>
            </section>

            <aside className="list-panel">
              <SegmentList
                segments={segmentsWithDistance}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                reports={reportsBySegment}
              />
            </aside>
          </>
        ) : (
          <section className="list-panel list-panel-full">
            <SegmentList
              segments={segmentsWithDistance}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              reports={reportsBySegment}
            />
          </section>
        )}
      </main>

      <SegmentSheet
        key={selectedSegment?.id ?? 'none'}
        segment={selectedSegment}
        nowHHMM={nowHHMM}
        onClose={() => setSelectedId(null)}
        distanceMeters={selectedDistance}
        rankBreakdown={selectedRankBreakdown}
        riskMode={riskMode}
        latestReport={latestReport}
        onReport={handleSegmentReport}
      />
      <Suspense fallback={null}>
        <DatasetInfoSheet
          open={infoOpen}
          info={buildDatasetInfoModel({
            latest: latestInfo,
            meta: datasetMeta,
            manifest: manifestInfo,
            report: ingestReport,
            metricsHistory,
            dataSource: dataSourceLabel,
          })}
          onClose={() => setInfoOpen(false)}
        />
      </Suspense>
    </div>
  )
}

export default App
