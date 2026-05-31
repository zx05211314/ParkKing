import type { KeyboardEvent } from 'react'
import type { GeocodeResult } from '../map/geocoder'
import {
  getSavedAddressKey,
  isSameSavedAddress,
  type FavoriteAddress,
  type FavoriteAddressRole,
} from './recentAddresses'
import { AddressResultBadges } from './AddressResultBadges'

interface AddressSearchResultListSectionProps<TResult extends GeocodeResult> {
  title?: string
  meta?: string
  clearLabel?: string
  results: TResult[]
  baseIndex: number
  searchAnchor: { result: GeocodeResult } | null
  favoriteAddresses: FavoriteAddress[]
  favoriteRoleLabels: Record<FavoriteAddressRole, string>
  registerSearchActionRef: (index: number, element: HTMLButtonElement | null) => void
  onSearchActionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void
  onChooseResult: (result: TResult) => void | Promise<void>
  onToggleFavoriteAddress: (result: GeocodeResult) => void
  onClear?: () => void
  getActionLabel: (result: TResult) => string
  includeRecentBadges?: boolean
}

export function AddressSearchResultListSection<TResult extends GeocodeResult>({
  title,
  meta,
  clearLabel,
  results,
  baseIndex,
  searchAnchor,
  favoriteAddresses,
  favoriteRoleLabels,
  registerSearchActionRef,
  onSearchActionKeyDown,
  onChooseResult,
  onToggleFavoriteAddress,
  onClear,
  getActionLabel,
  includeRecentBadges = false,
}: AddressSearchResultListSectionProps<TResult>) {
  if (results.length === 0) {
    return null
  }

  const list = (
    <div className="search-result-list">
      {results.map((result, resultIndex) => {
        const actionIndex = baseIndex + resultIndex
        const isPinned = searchAnchor
          ? isSameSavedAddress(searchAnchor.result, result)
          : false

        return (
          <div key={getSavedAddressKey(result)} className="search-result-row">
            <button
              type="button"
              ref={(element) => registerSearchActionRef(actionIndex, element)}
              className={isPinned ? 'search-result active' : 'search-result'}
              onKeyDown={(event) => onSearchActionKeyDown(event, actionIndex)}
              onClick={() => {
                void onChooseResult(result)
              }}
            >
              <div className="search-result-main">
                <span className="search-result-label">{result.label}</span>
                <AddressResultBadges
                  result={result}
                  favoriteAddresses={favoriteAddresses}
                  favoriteRoleLabels={favoriteRoleLabels}
                  searchAnchor={searchAnchor}
                  includeRecent={includeRecentBadges}
                />
              </div>
            </button>
            <button
              type="button"
              className="address-recommendations-action"
              onClick={() => onToggleFavoriteAddress(result)}
            >
              {getActionLabel(result)}
            </button>
          </div>
        )
      })}
    </div>
  )

  if (!title) {
    return list
  }

  return (
    <div className="address-recommendations">
      <div className="address-recommendations-header">
        <div className="address-recommendations-heading">
          <div className="control-label">{title}</div>
          {meta ? <div className="control-meta">{meta}</div> : null}
        </div>
        {clearLabel && onClear ? (
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onClear}
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
      {list}
    </div>
  )
}
