export const BROWSER_RESUME_WINDOW_EVENTS = [
  'online',
  'focus',
  'pageshow',
] as const

export const shouldResumeFromVisibilityState = (
  visibilityState: string | null | undefined,
) => visibilityState === 'visible'
