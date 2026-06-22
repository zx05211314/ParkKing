export const REQUIRED_RENDER_RUNTIME_ENV = {
  PARKKING_SYNC_CORS_ORIGINS: 'https://parkking.onrender.com',
  PARKKING_GEOCODER_REQUEST_TIMEOUT_MS: '5000',
  PARKKING_ROUTING_REQUEST_TIMEOUT_MS: '8000',
} as const

export const buildRenderDeploymentEnv = (urls: {
  packageUrl: string
  manifestUrl: string
}) => ({
  PARKKING_RELEASE_PACKAGE_URL: urls.packageUrl,
  PARKKING_RELEASE_MANIFEST_URL: urls.manifestUrl,
  ...REQUIRED_RENDER_RUNTIME_ENV,
})

export const renderEnvAssignments = (env: Record<string, string>) =>
  Object.entries(env).map(([key, value]) => `${key}=${value}`)
