interface SavedPlanIntentSuggestionAppliedMessageOptions {
  appliedCount: number
  summaryLabel: string
  singularTargetLabel: string
  remainingManualCount: number
  returnToAllIntents?: boolean
}

interface SavedPlanIntentSuggestionAppliedForIntentMessageOptions {
  appliedCount: number
  intentLabel: string
  singularTargetLabel: string
  remainingUntaggedCount: number
  remainingSuggestedCount: number
  remainingManualCount: number
  returnToAllIntents?: boolean
}

const formatCountedTargetLabel = (count: number, singularTargetLabel: string) =>
  `${count} ${singularTargetLabel}${count === 1 ? '' : 's'}`

const buildRemainingParts = (
  remainingSuggestedCount: number,
  remainingManualCount: number,
) => {
  const remainingParts: string[] = []
  if (remainingSuggestedCount > 0) {
    remainingParts.push(`${remainingSuggestedCount} suggested`)
  }
  if (remainingManualCount > 0) {
    remainingParts.push(`${remainingManualCount} manual`)
  }
  return remainingParts
}

export const buildSavedPlanIntentSuggestionsAppliedMessage = ({
  appliedCount,
  summaryLabel,
  singularTargetLabel,
  remainingManualCount,
  returnToAllIntents = false,
}: SavedPlanIntentSuggestionAppliedMessageOptions) => {
  const countedTargetLabel = formatCountedTargetLabel(
    appliedCount,
    singularTargetLabel,
  )

  if (returnToAllIntents) {
    return `Applied suggestions to ${countedTargetLabel} (${summaryLabel}) and returned to all intents.`
  }

  return remainingManualCount > 0
    ? `Applied suggestions to ${countedTargetLabel} (${summaryLabel}). ${remainingManualCount} still need manual tagging.`
    : `Applied suggestions to ${countedTargetLabel} (${summaryLabel}).`
}

export const buildSavedPlanIntentSuggestionsAppliedForIntentMessage = ({
  appliedCount,
  intentLabel,
  singularTargetLabel,
  remainingUntaggedCount,
  remainingSuggestedCount,
  remainingManualCount,
  returnToAllIntents = false,
}: SavedPlanIntentSuggestionAppliedForIntentMessageOptions) => {
  const countedTargetLabel = formatCountedTargetLabel(
    appliedCount,
    singularTargetLabel,
  )

  if (returnToAllIntents) {
    return `Applied ${intentLabel} suggestions to ${countedTargetLabel} and returned to all intents.`
  }

  const remainingParts = buildRemainingParts(
    remainingSuggestedCount,
    remainingManualCount,
  )

  return remainingParts.length > 0
    ? `Applied ${intentLabel} suggestions to ${countedTargetLabel}. ${remainingUntaggedCount} remain (${remainingParts.join(', ')}).`
    : `Applied ${intentLabel} suggestions to ${countedTargetLabel}.`
}
