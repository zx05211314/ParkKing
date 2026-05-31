import { RuntimeSettingsCoreSection } from './RuntimeSettingsCoreSection'
import { RuntimeSettingsFilterSection } from './RuntimeSettingsFilterSection'
import { RuntimeSettingsOverlaySection } from './RuntimeSettingsOverlaySection'
import type { RuntimeSettingsPanelProps } from './runtimeSettingsPanelTypes'

export function RuntimeSettingsPanel(props: RuntimeSettingsPanelProps) {
  return (
    <>
      <RuntimeSettingsCoreSection {...props} />
      <RuntimeSettingsOverlaySection {...props} />
      <RuntimeSettingsFilterSection {...props} />
    </>
  )
}
