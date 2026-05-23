import type { ComponentProps } from 'react'
import { SegmentSheet } from './SegmentSheet'

interface AppOverlayHostProps {
  segmentSheetKey: string
  segmentSheetProps: ComponentProps<typeof SegmentSheet>
}

export const AppOverlayHost = ({
  segmentSheetKey,
  segmentSheetProps,
}: AppOverlayHostProps) => (
  <SegmentSheet key={segmentSheetKey} {...segmentSheetProps} />
)
