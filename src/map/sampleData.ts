import type { Confidence, CurbMarking, Segment, SignOverride } from '../ui/types'

export const center: [number, number] = [121.5654, 25.033]

const curbMarkings: CurbMarking[] = [
  'RED',
  'YELLOW',
  'WHITE_EDGE',
  'NONE',
  'UNKNOWN',
]

const confidences: Confidence[] = ['HIGH', 'MEDIUM', 'LOW']

const signOverrides: Record<number, SignOverride> = {
  2: {
    note: 'School pickup zone',
    confidence: 'MED',
    timeWindows: [
      { label: 'Morning', startHHMM: '07:00', endHHMM: '09:00' },
      { label: 'Afternoon', startHHMM: '15:00', endHHMM: '18:00' },
    ],
  },
  7: {
    note: 'Loading only (weekday)',
    confidence: 'HIGH',
    timeWindows: [
      { label: 'Weekday AM', startHHMM: '09:00', endHHMM: '11:30' },
    ],
  },
  12: {
    note: 'Event zone signage',
    confidence: 'LOW',
    timeWindows: [
      { label: 'Event window', startHHMM: '18:00', endHHMM: '22:00' },
    ],
  },
}

const buildPath = (
  base: [number, number],
  points: number,
  driftLng: number,
  driftLat: number,
): [number, number][] => {
  const path: [number, number][] = []
  for (let i = 0; i < points; i += 1) {
    const bump = i % 2 === 0 ? 0.00005 : -0.00005
    path.push([
      base[0] + i * driftLng + bump,
      base[1] + i * driftLat - bump,
    ])
  }
  return path
}

export const segments: Segment[] = Array.from({ length: 30 }, (_, index) => {
  const col = index % 6
  const row = Math.floor(index / 6)
  const offsetLng = (col - 2.5) * 0.0012
  const offsetLat = (row - 2.5) * 0.001
  const base: [number, number] = [
    center[0] + offsetLng,
    center[1] + offsetLat,
  ]
  const points = 2 + (index % 4)
  const driftLng = (index % 2 === 0 ? 1 : -1) * 0.00025
  const driftLat = (index % 3 === 0 ? 1 : -1) * 0.0002

  const segment: Segment = {
    id: `seg-${index + 1}`,
    name: `Segment ${index + 1}`,
    curbMarking: curbMarkings[index % curbMarkings.length],
    confidence: confidences[index % confidences.length],
    path: buildPath(base, points, driftLng, driftLat),
    signOverride: signOverrides[index + 1],
  }

  if (index === 1) {
    segment.path = [
      [center[0] - 0.0012, center[1] - 0.0002],
      [center[0], center[1]],
      [center[0] + 0.0012, center[1] + 0.0002],
    ]
  }

  return segment
})
