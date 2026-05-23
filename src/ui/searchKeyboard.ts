export const getWrappedIndex = (
  currentIndex: number,
  itemCount: number,
  delta: number,
): number => {
  if (itemCount <= 0) {
    return -1
  }

  const nextIndex = currentIndex + delta
  const wrappedIndex = ((nextIndex % itemCount) + itemCount) % itemCount

  return wrappedIndex
}
