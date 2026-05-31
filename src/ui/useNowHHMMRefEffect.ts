import { useEffect, type MutableRefObject } from 'react'

export const useNowHHMMRefEffect = (
  nowHHMM: string,
  nowHHMMRef: MutableRefObject<string>,
) => {
  useEffect(() => {
    nowHHMMRef.current = nowHHMM
  }, [nowHHMM, nowHHMMRef])
}
