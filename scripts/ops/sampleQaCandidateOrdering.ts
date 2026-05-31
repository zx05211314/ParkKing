export const createSeededRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const shuffleDeterministic = <T>(items: T[], seed: number) => {
  const rng = createSeededRng(seed)
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = items[index]
    items[index] = items[swapIndex] as T
    items[swapIndex] = current as T
  }
  return items
}
