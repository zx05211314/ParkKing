import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SyncService } from './syncServiceTypes'

export interface SyncServiceRequestContext {
  req: IncomingMessage
  res: ServerResponse
  service: SyncService
  scope: string
  url: URL
  maxBodyBytes?: number
}
