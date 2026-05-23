import { defineConfig, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import {
  createGeocodeProxyMiddleware,
  createGeocodeProxyService,
  resolveGeocodeProxyConfig,
} from './scripts/ops/geocodeProxy.ts'
import {
  createRoutingProxyMiddleware,
  createRoutingProxyService,
  resolveRoutingProxyConfig,
} from './scripts/ops/routingProxy.ts'
import {
  createParkingAnswerService,
  createParkingAnswerServiceMiddleware,
  resolveParkingAnswerServiceConfig,
} from './scripts/ops/parkingAnswerService.ts'
import {
  createSyncService,
  createSyncServiceMiddleware,
  resolveSyncServiceConfig,
} from './scripts/ops/syncService.ts'

const geocodeProxyConfig = resolveGeocodeProxyConfig()
const geocodeProxyService = createGeocodeProxyService(geocodeProxyConfig)
const geocodeProxyMiddleware = createGeocodeProxyMiddleware(
  geocodeProxyService,
  geocodeProxyConfig.path,
  geocodeProxyConfig,
)
const routingProxyConfig = resolveRoutingProxyConfig()
const routingProxyService = createRoutingProxyService(routingProxyConfig)
const routingProxyMiddleware = createRoutingProxyMiddleware(
  routingProxyService,
  routingProxyConfig.path,
  routingProxyConfig,
)
const parkingAnswerServiceConfig = resolveParkingAnswerServiceConfig()
const parkingAnswerService = createParkingAnswerService()
const parkingAnswerServiceMiddleware = createParkingAnswerServiceMiddleware(
  parkingAnswerService,
  parkingAnswerServiceConfig,
  parkingAnswerServiceConfig.path,
)
const syncServiceConfig = resolveSyncServiceConfig()
const syncService = createSyncService(syncServiceConfig)
const syncServiceMiddleware = createSyncServiceMiddleware(
  syncService,
  syncServiceConfig.path,
  syncServiceConfig.defaultScope,
  syncServiceConfig,
)

const geocodeProxyPlugin = {
  name: 'parkking-geocode-proxy',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      void geocodeProxyMiddleware(req, res, next)
    })
    server.middlewares.use((req, res, next) => {
      void routingProxyMiddleware(req, res, next)
    })
    server.middlewares.use((req, res, next) => {
      void parkingAnswerServiceMiddleware(req, res, next)
    })
    server.middlewares.use((req, res, next) => {
      void syncServiceMiddleware(req, res, next)
    })
  },
  configurePreviewServer(server: PreviewServer) {
    server.middlewares.use((req, res, next) => {
      void geocodeProxyMiddleware(req, res, next)
    })
    server.middlewares.use((req, res, next) => {
      void routingProxyMiddleware(req, res, next)
    })
    server.middlewares.use((req, res, next) => {
      void parkingAnswerServiceMiddleware(req, res, next)
    })
    server.middlewares.use((req, res, next) => {
      void syncServiceMiddleware(req, res, next)
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), geocodeProxyPlugin],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('maplibre-gl')) {
              return 'maplibre'
            }
            if (id.includes('@turf')) {
              return 'turf'
            }
            if (id.includes('rbush')) {
              return 'rbush'
            }
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
