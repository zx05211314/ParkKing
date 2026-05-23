import { useCallback } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { getWrappedIndex } from './searchKeyboard'
import type { SegmentSuggestion } from './segmentSelectionTypes'

interface UseSegmentSuggestionActionsOptions {
  segmentFilterSuggestions: SegmentSuggestion[]
  segmentSuggestionRefs: RefObject<(HTMLButtonElement | null)[]>
  filterInputRef: RefObject<HTMLInputElement | null>
  setFilterQuery: (value: string) => void
  setSelectedId: (value: string) => void
  setActiveView: (value: 'LIST' | 'MAP') => void
}

interface UseSegmentSuggestionActionsResult {
  handleSelectSegmentSuggestion: (segment: SegmentSuggestion) => void
  handleFilterInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  handleSegmentSuggestionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void
}

export const useSegmentSuggestionActions = ({
  segmentFilterSuggestions,
  segmentSuggestionRefs,
  filterInputRef,
  setFilterQuery,
  setSelectedId,
  setActiveView,
}: UseSegmentSuggestionActionsOptions): UseSegmentSuggestionActionsResult => {
  const handleSelectSegmentSuggestion = useCallback(
    (segment: SegmentSuggestion) => {
      setFilterQuery(segment.name)
      setSelectedId(segment.id)
      setActiveView('MAP')
    },
    [setActiveView, setFilterQuery, setSelectedId],
  )

  const focusSegmentSuggestion = useCallback(
    (index: number) => {
      if (index < 0) {
        return
      }
      segmentSuggestionRefs.current[index]?.focus()
    },
    [segmentSuggestionRefs],
  )

  const handleFilterInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (segmentFilterSuggestions.length === 0) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusSegmentSuggestion(0)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusSegmentSuggestion(segmentFilterSuggestions.length - 1)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        handleSelectSegmentSuggestion(segmentFilterSuggestions[0])
      }
    },
    [focusSegmentSuggestion, handleSelectSegmentSuggestion, segmentFilterSuggestions],
  )

  const handleSegmentSuggestionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (segmentFilterSuggestions.length === 0) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusSegmentSuggestion(getWrappedIndex(index, segmentFilterSuggestions.length, 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusSegmentSuggestion(getWrappedIndex(index, segmentFilterSuggestions.length, -1))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        focusSegmentSuggestion(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        focusSegmentSuggestion(segmentFilterSuggestions.length - 1)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        filterInputRef.current?.focus()
      }
    },
    [filterInputRef, focusSegmentSuggestion, segmentFilterSuggestions.length],
  )

  return {
    handleSelectSegmentSuggestion,
    handleFilterInputKeyDown,
    handleSegmentSuggestionKeyDown,
  }
}
