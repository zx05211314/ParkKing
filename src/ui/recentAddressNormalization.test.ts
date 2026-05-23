import { describe, expect, it } from 'vitest'
import {
  getSavedAddressKey,
  normalizeFavoriteAddress,
  normalizeSavedAddress,
} from './recentAddressNormalization'

describe('recentAddressNormalization', () => {
  it('normalizes saved addresses and generates a fallback id when needed', () => {
    expect(
      normalizeSavedAddress({
        label: ' Taipei 101 ',
        center: [121.5645, 25.0338],
        bounds: null,
      }),
    ).toEqual({
      id: getSavedAddressKey({
        id: 'Taipei 101',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
      }),
      label: 'Taipei 101',
      center: [121.5645, 25.0338],
      bounds: null,
    })
  })

  it('normalizes favorite roles and rejects invalid address payloads', () => {
    expect(
      normalizeFavoriteAddress({
        id: 'a',
        label: 'Main Station',
        center: [121.517, 25.0477],
        bounds: null,
        role: 'HOME',
      }),
    ).toEqual({
      id: 'a',
      label: 'Main Station',
      center: [121.517, 25.0477],
      bounds: null,
      role: 'HOME',
    })

    expect(
      normalizeSavedAddress({
        label: 'Broken',
        center: ['121.56', 25.03],
      }),
    ).toBeNull()
  })
})
