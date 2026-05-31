import { useCallback, useEffect, useRef } from 'react'

interface UseInteractionRefsOptions {
  searchActionCount: number
  segmentSuggestionCount: number
}

export const useInteractionRefs = ({
  searchActionCount,
  segmentSuggestionCount,
}: UseInteractionRefsOptions) => {
  const segmentSuggestionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const searchActionRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    searchActionRefs.current.length = searchActionCount
  }, [searchActionCount])

  useEffect(() => {
    segmentSuggestionRefs.current.length = segmentSuggestionCount
  }, [segmentSuggestionCount])

  const registerSearchActionRef = useCallback(
    (index: number, element: HTMLButtonElement | null) => {
      searchActionRefs.current[index] = element
    },
    [],
  )

  const registerSegmentSuggestionRef = useCallback(
    (index: number, element: HTMLButtonElement | null) => {
      segmentSuggestionRefs.current[index] = element
    },
    [],
  )

  return {
    segmentSuggestionRefs,
    searchActionRefs,
    registerSearchActionRef,
    registerSegmentSuggestionRef,
  }
}
