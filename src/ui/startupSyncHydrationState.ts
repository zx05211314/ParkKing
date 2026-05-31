export type StartupSyncHydrationPhase =
  | 'sync-bootstrap'
  | 'local-fallback'
  | 'ready'

export type StartupSyncHydrationSource = 'shared' | 'local-fallback' | null

export const resolveStartupSyncHydrationDetail = (
  phase: StartupSyncHydrationPhase,
  source: StartupSyncHydrationSource,
  completedAgo: string | null = null,
) => {
  switch (phase) {
    case 'sync-bootstrap':
      return 'Loading shared saved plans and reports for this scope.'
    case 'local-fallback':
      return 'Shared bootstrap is unavailable; loading local saved plans and reports.'
    case 'ready':
      if (source === 'shared') {
        return `Started from shared saved plans and reports for this scope${
          completedAgo ? ` (${completedAgo})` : ''
        }.`
      }
      if (source === 'local-fallback') {
        return `Started from local saved plans and reports because shared bootstrap was unavailable${
          completedAgo ? ` (${completedAgo})` : ''
        }.`
      }
      return null
  }
}
