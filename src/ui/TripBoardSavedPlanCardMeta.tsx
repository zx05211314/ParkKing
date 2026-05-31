import type { SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardSavedPlanCardProps } from './tripBoardSavedPlanCardTypes'

interface TripBoardSavedPlanCardMetaProps
  extends Pick<
    TripBoardSavedPlanCardProps,
    | 'formatSavedPlanTimestamp'
    | 'getSavedPlanQualitySummary'
    | 'getSavedPlanEtaSummary'
    | 'getSavedPlanSettingChips'
  > {
  plan: TripBoardSavedPlanCardProps['plan']
  conflictFields: SavedPlanConflictFieldDetail[]
}

const renderChipRow = (prefix: string, planUrl: string, chips: string[]) => {
  if (chips.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-settings">
      {chips.map((chip) => (
        <span key={`${prefix}:${planUrl}:${chip}`}>{chip}</span>
      ))}
    </div>
  )
}

export const TripBoardSavedPlanCardMeta = ({
  plan,
  conflictFields,
  formatSavedPlanTimestamp,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
}: TripBoardSavedPlanCardMetaProps) => {
  const qualitySummary = getSavedPlanQualitySummary(plan)
  const etaSummary = getSavedPlanEtaSummary(plan)
  const settingChips = getSavedPlanSettingChips(plan)

  return (
    <>
      <div className="saved-plan-meta">
        {plan.datasetId ? <span>{plan.datasetId}</span> : null}
        {plan.addressLabel ? <span>{plan.addressLabel}</span> : null}
        {plan.segmentName ? <span>{plan.segmentName}</span> : null}
        {plan.targetLabel ? <span>{plan.targetLabel}</span> : null}
      </div>
      {renderChipRow('saved-plan-quality', plan.url, qualitySummary)}
      {renderChipRow('saved-plan-eta', plan.url, etaSummary)}
      {renderChipRow('saved-plan-setting', plan.url, settingChips)}
      {conflictFields.length > 0 ? (
        <div className="saved-plan-settings">
          {conflictFields.map((field) => (
            <span key={`saved-plan-conflict:${plan.url}:${field.label}`}>
              Conflict {field.label}: kept {field.keptValue} / shared {field.sharedValue}
            </span>
          ))}
        </div>
      ) : null}
      <div className="control-meta">Saved: {formatSavedPlanTimestamp(plan.createdAt)}</div>
    </>
  )
}
