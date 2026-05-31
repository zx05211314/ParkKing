import { describe, expect, it } from 'vitest'
import { extractRoutingUpstreamMessage } from './routingProxyUpstreamMessage'

describe('extractRoutingUpstreamMessage', () => {
  it('falls back to status text when the payload has no message', () => {
    expect(extractRoutingUpstreamMessage(503, { code: 'NoRoute' })).toBe(
      'Upstream router failed with 503.',
    )
  })
})
