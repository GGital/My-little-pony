import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { EventSearchResponse } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { AuthContext } from '../auth/AuthContext'
import { EventCard } from '../components/EventCard'
import { FilterChips } from '../components/FilterChips'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { EVENT_TABS, PageTop } from '../components/PageTop'
import { gameLabel } from '../utils/games'
import { EMPTY_FILTERS, parseFilters, toQuery, type SearchFilters } from '../utils/searchParams'

export const EventList: React.FC = () => {
  // Read directly: the list is public, so it also renders where no AuthProvider wraps it.
  const participant = useContext(AuthContext)?.user?.role === 'PARTICIPANT'
  const [searchParams, setSearchParams] = useSearchParams()
  // The URL holds the filters (UX-02): Back / Forward and shared links restore a search.
  const search = searchParams.toString()
  const filters = useMemo(() => parseFilters(new URLSearchParams(search)), [search])
  const [result, setResult] = useState<EventSearchResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<EventSearchResponse>(`/api/events?${toQuery(filters).toString()}`, {
        auth: 'optional',
      })
      if (isCurrent()) setResult({ items: data.items ?? [], meta: data.meta })
    } catch (err) {
      if (isCurrent()) setError(err instanceof Error ? err.message : 'Failed to load events.')
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    let current = true
    void fetchEvents(() => current)
    return () => {
      current = false // a slower, older response must not replace a newer search
    }
  }, [fetchEvents])

  // Every change is a new history entry, so Back returns to the earlier list.
  const go = (next: SearchFilters) => setSearchParams(toQuery(next))

  const events = result?.items ?? []
  const totalItems = result?.meta?.totalItems ?? events.length
  const filtered = toQuery({ ...filters, page: 1 }).toString() !== toQuery(EMPTY_FILTERS).toString()
  const now = Date.now()

  return (
    <>
      <PageTop
        title={filters.game ? `${gameLabel(filters.game)} events` : 'Find an Event'}
        subtitle="Tournaments, casual nights and release events in Bangkok. All times are Bangkok time."
        tabs={participant ? EVENT_TABS : undefined}
      />
      <div className="pbody">
        <SearchBar filters={filters} onSearch={go} />
        <FilterChips filters={filters} onChange={go} />
        <p className="sr-only" role="status" aria-live="polite">
          {loading || error ? '' : `${totalItems} ${totalItems === 1 ? 'event' : 'events'} found`}
        </p>

        {loading ? (
          <Loading label="Loading events…" cards={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchEvents()} />
        ) : events.length === 0 && filtered ? (
          <EmptyState
            title="No events match your search."
            description="Try fewer filters or a different word."
            action={{ label: 'Clear filters', onClick: () => go({ ...EMPTY_FILTERS }) }}
          />
        ) : events.length === 0 && filters.page > 1 ? (
          <EmptyState
            title="No events on this page."
            action={{ label: 'Back to page 1', onClick: () => go({ ...filters, page: 1 }) }}
          />
        ) : events.length === 0 ? (
          <EmptyState
            title="No upcoming events yet"
            description="Check back soon for upcoming tournaments and casual meetups."
          />
        ) : (
          <>
            <div className="listhead">
              <h2>{filtered ? 'Search results' : 'Upcoming events'}</h2>
              <span className="lbl">Sorted by date</span>
            </div>
            <div className="stack">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  to={`/events/${event.id}`}
                  hideGame={!!filters.game}
                  endedChip={
                    event.status === 'CANCELLED'
                      ? 'Cancelled'
                      : new Date(event.startAt).getTime() <= now
                        ? 'Past'
                        : undefined
                  }
                />
              ))}
            </div>
            <Pagination page={filters.page} totalItems={totalItems} onPage={(page) => go({ ...filters, page })} />
          </>
        )}
      </div>
    </>
  )
}
