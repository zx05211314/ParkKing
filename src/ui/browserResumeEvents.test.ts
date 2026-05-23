import { describe, expect, it } from 'vitest'
import {
  BROWSER_RESUME_WINDOW_EVENTS,
  shouldResumeFromVisibilityState,
} from './browserResumeEvents'

describe('browserResumeEvents', () => {
  it('exports the expected window resume events', () => {
    expect(BROWSER_RESUME_WINDOW_EVENTS).toEqual([
      'online',
      'focus',
      'pageshow',
    ])
  })

  it('only resumes from visible document state', () => {
    expect(shouldResumeFromVisibilityState('visible')).toBe(true)
    expect(shouldResumeFromVisibilityState('hidden')).toBe(false)
    expect(shouldResumeFromVisibilityState('prerender')).toBe(false)
    expect(shouldResumeFromVisibilityState(null)).toBe(false)
  })
})
