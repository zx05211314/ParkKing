import { describe, expect, it } from 'vitest'
import {
  addRecentAddress,
  findFavoriteAddress,
  hasSavedAddress,
  normalizeFavoriteAddresses,
  normalizeRecentAddresses,
  setFavoriteAddressRole,
  type FavoriteAddress,
  toggleSavedAddress,
} from './recentAddresses'

describe('normalizeRecentAddresses', () => {
  it('keeps valid recent addresses and drops invalid entries', () => {
    expect(
      normalizeRecentAddresses([
        {
          id: 'a',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
        },
        {
          label: '',
          center: [121.56, 25.03],
        },
        {
          label: 'Broken',
          center: ['121.56', 25.03],
        },
      ]),
    ).toEqual([
      {
        id: 'a',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
      },
    ])
  })

  it('dedupes entries by label and center while preserving order', () => {
    expect(
      normalizeRecentAddresses([
        {
          id: 'a',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
        },
        {
          id: 'b',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
        },
      ]),
    ).toHaveLength(1)
  })
})

describe('addRecentAddress', () => {
  it('moves the latest address to the front and caps the list', () => {
    const existing = [
      {
        id: 'a',
        label: 'Taipei 101',
        center: [121.5645, 25.0338] as [number, number],
        bounds: null,
      },
      {
        id: 'b',
        label: 'Main Station',
        center: [121.5170, 25.0477] as [number, number],
        bounds: null,
      },
    ]

    expect(
      addRecentAddress(existing, {
        id: 'c',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
      }, 2),
    ).toEqual([
      {
        id: 'c',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
      },
      {
        id: 'b',
        label: 'Main Station',
        center: [121.5170, 25.0477],
        bounds: null,
      },
    ])
  })
})

describe('toggleSavedAddress', () => {
  it('adds a new saved address to the front of the list', () => {
    expect(
      toggleSavedAddress(
        [
          {
            id: 'a',
            label: 'Main Station',
            center: [121.517, 25.0477],
            bounds: null,
            role: null,
          },
        ],
        {
          id: 'b',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
        },
      ),
    ).toEqual([
      {
        id: 'b',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
        role: null,
      },
      {
        id: 'a',
        label: 'Main Station',
        center: [121.517, 25.0477],
        bounds: null,
        role: null,
      },
    ])
  })

  it('removes an existing saved address when toggled again', () => {
    expect(
      toggleSavedAddress(
        [
          {
            id: 'a',
            label: 'Taipei 101',
            center: [121.5645, 25.0338],
            bounds: null,
            role: null,
          },
        ],
        {
          id: 'b',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
        },
      ),
    ).toEqual([])
  })
})

describe('normalizeFavoriteAddresses', () => {
  it('keeps favorite roles when present and defaults legacy entries to null', () => {
    expect(
      normalizeFavoriteAddresses([
        {
          id: 'a',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
          role: 'HOME',
        },
        {
          id: 'b',
          label: 'Main Station',
          center: [121.517, 25.0477],
          bounds: null,
        },
      ]),
    ).toEqual([
      {
        id: 'a',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
        role: 'HOME',
      },
      {
        id: 'b',
        label: 'Main Station',
        center: [121.517, 25.0477],
        bounds: null,
        role: null,
      },
    ])
  })
})

describe('setFavoriteAddressRole', () => {
  it('assigns a role and clears it from any previous favorite', () => {
    const existing: FavoriteAddress[] = [
      {
        id: 'a',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
        role: 'HOME',
      },
      {
        id: 'b',
        label: 'Main Station',
        center: [121.517, 25.0477],
        bounds: null,
        role: null,
      },
    ]

    expect(
      setFavoriteAddressRole(existing, existing[1], 'HOME'),
    ).toEqual([
      {
        id: 'b',
        label: 'Main Station',
        center: [121.517, 25.0477],
        bounds: null,
        role: 'HOME',
      },
      {
        id: 'a',
        label: 'Taipei 101',
        center: [121.5645, 25.0338],
        bounds: null,
        role: null,
      },
    ])
  })

  it('adds an unsaved address when assigning a role', () => {
    const next = {
      id: 'c',
      label: 'City Hall',
      center: [121.563, 25.0375] as [number, number],
      bounds: null,
    }

    expect(setFavoriteAddressRole([], next, 'WORK')).toEqual([
      {
        ...next,
        role: 'WORK',
      },
    ])
  })
})

describe('findFavoriteAddress', () => {
  it('returns the matching favorite entry with role metadata', () => {
    expect(
      findFavoriteAddress(
        [
          {
            id: 'a',
            label: 'Taipei 101',
            center: [121.5645, 25.0338],
            bounds: null,
            role: 'WORK',
          },
        ],
        {
          id: 'b',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
        },
      ),
    ).toEqual({
      id: 'a',
      label: 'Taipei 101',
      center: [121.5645, 25.0338],
      bounds: null,
      role: 'WORK',
    })
  })
})

describe('hasSavedAddress', () => {
  it('matches saved addresses by label and center', () => {
    expect(
      hasSavedAddress(
        [
          {
            id: 'a',
            label: 'Taipei 101',
            center: [121.5645, 25.0338],
            bounds: null,
          },
        ],
        {
          id: 'b',
          label: 'Taipei 101',
          center: [121.5645, 25.0338],
          bounds: null,
        },
      ),
    ).toBe(true)
  })
})
