import { STORE_SCHEMA_VERSION } from './syncServiceConfig'

export const dedupeSyncReports = (reports: unknown[]) => {
  const unique = new Map<string, unknown>()
  reports.forEach((report) => {
    if (!report || typeof report !== 'object') {
      return
    }
    const candidate = report as Record<string, unknown>
    const districtId =
      typeof candidate.districtId === 'string' ? candidate.districtId.trim() : ''
    const segmentId =
      typeof candidate.segmentId === 'string' ? candidate.segmentId.trim() : ''
    const status =
      candidate.status === 'LEGAL' ||
      candidate.status === 'ILLEGAL' ||
      candidate.status === 'UNCLEAR'
        ? candidate.status
        : null
    const createdAt =
      typeof candidate.createdAt === 'string' ? candidate.createdAt.trim() : ''
    if (!districtId || !segmentId || !status || !createdAt) {
      return
    }

    const note =
      typeof candidate.note === 'string' && candidate.note.trim().length > 0
        ? candidate.note.trim()
        : null
    const schemaVersion =
      typeof candidate.schemaVersion === 'number'
        ? candidate.schemaVersion
        : STORE_SCHEMA_VERSION
    const normalized = {
      ...candidate,
      districtId,
      segmentId,
      status,
      createdAt,
      note,
      schemaVersion,
    }
    const key = [
      districtId,
      segmentId,
      status,
      createdAt,
      note ?? '',
      schemaVersion,
    ].join('::')
    unique.set(key, normalized)
  })

  return Array.from(unique.values()).sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  )
}
