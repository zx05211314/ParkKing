import { describe, expect, it } from 'vitest'
import { getTripBoardSavedPlanGroupsEmptyMessage } from './tripBoardSavedPlanGroupsState'

describe('tripBoardSavedPlanGroupsState', () => {
  it('builds the correct empty-state message for query and untagged filters', () => {
    expect(
      getTripBoardSavedPlanGroupsEmptyMessage(' civic ', 'ALL', 'ALL'),
    ).toBe('No saved plans match "civic".')
    expect(
      getTripBoardSavedPlanGroupsEmptyMessage('', 'UNTAGGED', 'SUGGESTED'),
    ).toBe('No suggested untagged saved plans match the current trip board filters.')
    expect(
      getTripBoardSavedPlanGroupsEmptyMessage('', 'UNTAGGED', 'MANUAL'),
    ).toBe('No manual-review untagged saved plans match the current trip board filters.')
    expect(
      getTripBoardSavedPlanGroupsEmptyMessage('', 'UNTAGGED', 'ALL'),
    ).toBe('No untagged saved plans match the current trip board filters.')
  })
})
