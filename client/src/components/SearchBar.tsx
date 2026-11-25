import React, { useEffect, useState } from 'react'
import { Icon } from './Icon'
import type { SearchFilters } from '../utils/searchParams'

export interface SearchBarProps {
  filters: SearchFilters
  /** Called with the draft when Search is pressed (or Enter); the page resets to 1. */
  onSearch: (draft: SearchFilters) => void
}

/** Feature-J search bar: native controls so it works with the keyboard and screen readers (contracts §7 UI). */
export const SearchBar: React.FC<SearchBarProps> = ({ filters, onSearch }) => {
  const [draft, setDraft] = useState<SearchFilters>(filters)
  // Back / Forward / chip removal change the URL: the form follows it.
  useEffect(() => setDraft(filters), [filters])
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <form
      className="searchform"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch({ ...draft, page: 1 })
      }}
    >
      <label className="searchform__field searchform__field--wide">
        <span className="lbl">Where</span>
        <input
          type="search"
          value={draft.q}
          maxLength={100}
          placeholder="Store, venue or city"
          onChange={(e) => set('q', e.target.value)}
        />
      </label>
      <label className="searchform__field">
        <span className="lbl">Event type</span>
        <select value={draft.type} onChange={(e) => set('type', e.target.value)}>
          <option value="">All types</option>
          <option value="CASUAL">Casual</option>
          <option value="TOURNAMENT">Tournament</option>
          <option value="RELEASE">Release</option>
        </select>
      </label>
      <label className="searchform__field">
        <span className="lbl">Format</span>
        <select value={draft.format} onChange={(e) => set('format', e.target.value)}>
          <option value="">All formats</option>
          <option value="CONSTRUCTED">Constructed</option>
          <option value="SEALED">Sealed</option>
          <option value="DRAFT">Draft</option>
        </select>
      </label>
      <label className="searchform__field">
        <span className="lbl">From</span>
        <input type="date" value={draft.from} onChange={(e) => set('from', e.target.value)} />
      </label>
      <label className="searchform__field">
        <span className="lbl">To</span>
        <input type="date" value={draft.to} onChange={(e) => set('to', e.target.value)} />
      </label>
      <label className="searchform__check">
        <input
          type="checkbox"
          checked={draft.seatsAvailable}
          onChange={(e) => set('seatsAvailable', e.target.checked)}
        />
        Seats available only
      </label>
      <label className="searchform__check">
        <input type="checkbox" checked={draft.past} onChange={(e) => set('past', e.target.checked)} />
        Show past and cancelled events
      </label>
      <button type="submit" className="search__btn">
        <Icon name="search" />
        <span>Search</span>
      </button>
    </form>
  )
}
