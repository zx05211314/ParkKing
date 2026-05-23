import { describe, expect, it } from 'vitest'
import { shuffleDeterministic } from './sampleQaCandidateOrdering'

describe('sampleQaCandidateOrdering', () => {
  it('shuffles deterministically for the same seed', () => {
    const values = [1, 2, 3, 4, 5]
    expect(shuffleDeterministic([...values], 7)).toEqual(
      shuffleDeterministic([...values], 7),
    )
  })
})
