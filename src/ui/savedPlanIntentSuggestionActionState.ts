import {
  buildSavedPlanIntentSuggestionsAppliedForIntentMessage,
  buildSavedPlanIntentSuggestionsAppliedMessage,
} from './savedPlanIntentMessages'
import type {
  SavedPlanIntent,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionSummary,
} from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface ResolveSavedPlanIntentSuggestionApplyStateOptions {
  untaggedPlansCount: number
  assignments: SavedPlanIntentSuggestionAssignment[]
  suggestionSummary: SavedPlanIntentSuggestionSummary
  singularTargetLabel: string
  pluralTargetLabel: string
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
  returnToAllIntentsWhenNoRemainingManual?: boolean
}

interface ResolveSavedPlanIntentSuggestionApplyForIntentStateOptions {
  untaggedPlansCount: number
  filteredAssignments: SavedPlanIntentSuggestionAssignment[]
  totalSuggestedCount: number
  singularTargetLabel: string
  pluralTargetLabel: string
  intentLabel: string
  returnToAllIntentsWhenNoRemainingUntagged?: boolean
}

interface SavedPlanIntentSuggestionStatusResult {
  kind: 'status'
  status: TripBoardActionStatus
}

interface SavedPlanIntentSuggestionApplyResult {
  kind: 'apply'
  status: TripBoardActionStatus
  assignmentUrls: string[]
  remainingManualCount: number
  shouldReturnToAllIntents: boolean
}

interface SavedPlanIntentSuggestionApplyForIntentResult {
  kind: 'apply'
  status: TripBoardActionStatus
  assignmentUrls: string[]
  remainingUntaggedCount: number
  remainingSuggestedCount: number
  remainingManualCount: number
  shouldReturnToAllIntents: boolean
}

export const resolveSavedPlanIntentSuggestionApplyState = ({
  untaggedPlansCount,
  assignments,
  suggestionSummary,
  singularTargetLabel,
  pluralTargetLabel,
  formatSavedPlanIntentSummary,
  returnToAllIntentsWhenNoRemainingManual = false,
}: ResolveSavedPlanIntentSuggestionApplyStateOptions):
  | SavedPlanIntentSuggestionStatusResult
  | SavedPlanIntentSuggestionApplyResult => {
  if (untaggedPlansCount === 0) {
    return {
      kind: 'status',
      status: {
        kind: 'error',
        message: `No ${pluralTargetLabel} to auto-tag.`,
      },
    }
  }

  if (assignments.length === 0) {
    return {
      kind: 'status',
      status: {
        kind: 'success',
        message: `No ${pluralTargetLabel} have a strong intent suggestion yet.`,
      },
    }
  }

  const remainingManualCount = untaggedPlansCount - suggestionSummary.totalCount
  const summaryLabel = formatSavedPlanIntentSummary(suggestionSummary, 0)
  const shouldReturnToAllIntents =
    returnToAllIntentsWhenNoRemainingManual && remainingManualCount <= 0

  return {
    kind: 'apply',
    assignmentUrls: assignments.map((assignment) => assignment.url),
    remainingManualCount,
    shouldReturnToAllIntents,
    status: {
      kind: 'success',
      message: buildSavedPlanIntentSuggestionsAppliedMessage({
        appliedCount: suggestionSummary.totalCount,
        summaryLabel,
        singularTargetLabel,
        remainingManualCount,
        returnToAllIntents: shouldReturnToAllIntents,
      }),
    },
  }
}

export const resolveSavedPlanIntentSuggestionApplyForIntentState = ({
  untaggedPlansCount,
  filteredAssignments,
  totalSuggestedCount,
  singularTargetLabel,
  pluralTargetLabel,
  intentLabel,
  returnToAllIntentsWhenNoRemainingUntagged = false,
}: ResolveSavedPlanIntentSuggestionApplyForIntentStateOptions):
  | SavedPlanIntentSuggestionStatusResult
  | SavedPlanIntentSuggestionApplyForIntentResult => {
  if (untaggedPlansCount === 0) {
    return {
      kind: 'status',
      status: {
        kind: 'error',
        message: `No ${pluralTargetLabel} to auto-tag as ${intentLabel}.`,
      },
    }
  }

  if (filteredAssignments.length === 0) {
    return {
      kind: 'status',
      status: {
        kind: 'success',
        message: `No ${pluralTargetLabel} currently suggest ${intentLabel}.`,
      },
    }
  }

  const remainingUntaggedCount = untaggedPlansCount - filteredAssignments.length
  const remainingSuggestedCount = totalSuggestedCount - filteredAssignments.length
  const remainingManualCount = remainingUntaggedCount - remainingSuggestedCount
  const shouldReturnToAllIntents =
    returnToAllIntentsWhenNoRemainingUntagged && remainingUntaggedCount <= 0

  return {
    kind: 'apply',
    assignmentUrls: filteredAssignments.map((assignment) => assignment.url),
    remainingUntaggedCount,
    remainingSuggestedCount,
    remainingManualCount,
    shouldReturnToAllIntents,
    status: {
      kind: 'success',
      message: buildSavedPlanIntentSuggestionsAppliedForIntentMessage({
        appliedCount: filteredAssignments.length,
        intentLabel,
        singularTargetLabel,
        remainingUntaggedCount,
        remainingSuggestedCount,
        remainingManualCount,
        returnToAllIntents: shouldReturnToAllIntents,
      }),
    },
  }
}
