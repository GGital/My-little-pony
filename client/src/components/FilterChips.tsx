import React from 'react'
import { label } from '../utils/eventDisplay'
import { EMPTY_FILTERS, type SearchFilters } from '../utils/searchParams'

export interface FilterChipsProps {
  filters: SearchFilters
  /** Called with the filters left after one chip is removed (or none for Clear all). */
  onChange: (next: SearchFilters) => void
}

/** Active filters as chips with a remove button, plus Clear all (UX-03). */
export const FilterChips: React.FC<FilterChipsProps> = ({ filters, onChange }) => {
  const chips: { key: keyof SearchFilters; text: string }[] = []
  if (filters.q.trim()) chips.push({ key: 'q', text: `Matching: ${filters.q.trim()}` })
  if (filters.type) chips.push({ key: 'type', text: `Type: ${label(filters.type)}` })
  if (filters.format) chips.push({ key: 'format', text: `Format: ${label(filters.format)}` })
  if (filters.from) chips.push({ key: 'from', text: `From: ${filters.from}` })
  if (filters.to) chips.push({ key: 'to', text: `To: ${filters.to}` })
  if (filters.seatsAvailable) chips.push({ key: 'seatsAvailable', text: 'Seats available' })
  if (filters.past) chips.push({ key: 'past', text: 'Past and cancelled shown' })
  if (chips.length === 0) return null

  return (
    <div className="chips filterchips" aria-label="Active filters">
      {chips.map(({ key, text }) => (
        <span key={key} className="chip chip--filter">
          <span>{text}</span>
          <button
            type="button"
            aria-label={`Remove filter ${text}`}
            onClick={() => onChange({ ...filters, [key]: EMPTY_FILTERS[key], page: 1 })}
          >
            ×
          </button>
        </span>
      ))}
      <button type="button" className="linkbtn" onClick={() => onChange({ ...EMPTY_FILTERS })}>
        Clear all
      </button>
    </div>
  )
}
