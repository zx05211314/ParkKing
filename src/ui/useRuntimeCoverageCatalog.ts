import { useEffect, useState } from 'react'
import {
  getRuntimeCoverageCatalogUrl,
  parseRuntimeCoverageCatalog,
  type RuntimeCoverageCatalog,
  type RuntimeCoverageCatalogStatus,
} from '../data/coverageCatalog'

interface RuntimeCoverageCatalogState {
  catalog: RuntimeCoverageCatalog | null
  status: RuntimeCoverageCatalogStatus
}

export const loadRuntimeCoverageCatalog = async (
  url: string,
  signal?: AbortSignal,
): Promise<RuntimeCoverageCatalog> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Coverage catalog request failed (${response.status})`)
  }
  return parseRuntimeCoverageCatalog(await response.json())
}

export const useRuntimeCoverageCatalog = (): RuntimeCoverageCatalogState => {
  const [state, setState] = useState<RuntimeCoverageCatalogState>({
    catalog: null,
    status: 'loading',
  })

  useEffect(() => {
    const controller = new AbortController()
    loadRuntimeCoverageCatalog(getRuntimeCoverageCatalogUrl(), controller.signal)
      .then((catalog) => setState({ catalog, status: 'ready' }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        setState({ catalog: null, status: 'error' })
      })

    return () => controller.abort()
  }, [])

  return state
}
