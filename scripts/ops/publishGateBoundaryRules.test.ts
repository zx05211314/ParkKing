import { describe, expect, it } from 'vitest'
import { validatePublishGateBoundaryMetadata } from './publishGateBoundaryRules'

describe('validatePublishGateBoundaryMetadata', () => {
  it('flags missing boundary center and missing bbox independently', () => {
    expect(
      validatePublishGateBoundaryMetadata('xinyi', {
        boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'META_BOUNDARY_CENTER_MISSING' }),
      ]),
    )

    expect(validatePublishGateBoundaryMetadata('xinyi', {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'META_BOUNDARY_BBOX_MISSING' }),
        expect.objectContaining({ code: 'META_BOUNDARY_CENTER_MISSING' }),
      ]),
    )
  })
})
