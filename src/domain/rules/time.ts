import type { TimeWindow } from '../../ui/types'

export type TimeMode = 'NOW' | 'NIGHT'

export const DAY_START_HHMM = '07:00'
export const DAY_END_HHMM = '20:00'

export const YELLOW_TIME_WINDOWS: TimeWindow[] = [
  { label: 'Daytime', startHHMM: DAY_START_HHMM, endHHMM: DAY_END_HHMM },
  { label: 'Night', startHHMM: DAY_END_HHMM, endHHMM: DAY_START_HHMM },
]

export const toMinutes = (hhmm: string): number => {
  const [hh, mm] = hhmm.split(':').map((part) => Number(part))
  return hh * 60 + mm
}

export const isValidHHMM = (hhmm: string): boolean => {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    return false
  }
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

export const DAY_START_MINUTES = toMinutes(DAY_START_HHMM)
export const DAY_END_MINUTES = toMinutes(DAY_END_HHMM)

export const isDaytime = (hhmm: string): boolean => {
  const minutes = toMinutes(hhmm)
  return minutes >= DAY_START_MINUTES && minutes < DAY_END_MINUTES
}

export const isSameParkingTimeMode = (leftHHMM: string, rightHHMM: string): boolean =>
  isValidHHMM(leftHHMM) &&
  isValidHHMM(rightHHMM) &&
  isDaytime(leftHHMM) === isDaytime(rightHHMM)

export const isTimeWithinWindow = (
  hhmm: string,
  window: TimeWindow,
): boolean => {
  if (
    !isValidHHMM(hhmm) ||
    !isValidHHMM(window.startHHMM) ||
    !isValidHHMM(window.endHHMM)
  ) {
    return false
  }

  const current = toMinutes(hhmm)
  const start = toMinutes(window.startHHMM)
  const end = toMinutes(window.endHHMM)
  if (start === end) {
    return true
  }
  return start < end
    ? current >= start && current < end
    : current >= start || current < end
}

export const formatHHMM = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export const getCurrentHHMM = (): string => formatHHMM(new Date())

export const getDemoHHMM = (mode: TimeMode): string =>
  mode === 'NOW' ? '13:00' : '21:00'
