import { useCallback, type KeyboardEvent, type RefObject } from 'react'
import { getWrappedIndex } from './searchKeyboard'

interface UseSearchActionKeyboardOptions {
  searchActionCount: number
  searchActionRefs: RefObject<(HTMLButtonElement | null)[]>
  addressInputRef: RefObject<HTMLInputElement | null>
}

interface UseSearchActionKeyboardResult {
  handleAddressInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  handleSearchActionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void
}

export const useSearchActionKeyboard = ({
  searchActionCount,
  searchActionRefs,
  addressInputRef,
}: UseSearchActionKeyboardOptions): UseSearchActionKeyboardResult => {
  const focusSearchAction = useCallback(
    (index: number) => {
      if (index < 0) {
        return
      }
      searchActionRefs.current[index]?.focus()
    },
    [searchActionRefs],
  )

  const handleAddressInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (searchActionCount <= 0) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusSearchAction(0)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusSearchAction(searchActionCount - 1)
      }
    },
    [focusSearchAction, searchActionCount],
  )

  const handleSearchActionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (searchActionCount <= 0) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusSearchAction(getWrappedIndex(index, searchActionCount, 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusSearchAction(getWrappedIndex(index, searchActionCount, -1))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        focusSearchAction(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        focusSearchAction(searchActionCount - 1)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        addressInputRef.current?.focus()
      }
    },
    [addressInputRef, focusSearchAction, searchActionCount],
  )

  return {
    handleAddressInputKeyDown,
    handleSearchActionKeyDown,
  }
}
