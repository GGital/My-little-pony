import React, { useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { EventSummary } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { AuthContext } from '../auth/AuthContext'
import { EventCard } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { EVENT_TABS, PageTop } from '../components/PageTop'

export const EventList: React.FC = () => {
  // Read directly: the list is public, so it also renders where no AuthProvider wraps it.
  const participant = useContext(AuthContext)?.user?.role === 'PARTICIPANT'
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ items: EventSummary[] }>('/api/events', { auth: 'optional' })
      setEvents(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const field = (name: string, value: string, chevron = true) => (
    <div className="search__field">
      <div className="lbl">{name}</div>
      <div className="search__value">
        {value}
        {chevron && <Icon name="chev" size="sm" />}
      </div>
    </div>
  )

  return (
    <>
      <PageTop title="Find an Event" tabs={participant ? EVENT_TABS : undefined} />
      <div className="pbody">
        {/* Shown but inactive until Sprint 2 (FR-13; contracts §9 Behaviour 1). */}
        <div className="search" aria-disabled="true" title="Coming soon">
          {field('Where', 'Store, venue or city', false)}
          {field('Event type', 'All types')}
          {field('Format', 'All formats')}
          <button type="button" className="search__btn" disabled aria-label="Search (coming soon)">
            <Icon name="search" />
          </button>
        </div>
        <p className="search__soon">Search and filters arrive in Sprint 2.</p>

        {loading ? (
          <Loading label="Loading events…" cards={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchEvents} />
        ) : events.length === 0 ? (
          <EmptyState
            title="No upcoming events yet"
            description="Check back soon for upcoming tournaments and casual meetups."
          />
        ) : (
          <>
            <div className="listhead">
              <h2>Upcoming events</h2>
              <span className="lbl">Sorted by date</span>
            </div>
            <div className="stack">
              {events.map((event) => (
                <EventCard key={event.id} event={event} to={`/events/${event.id}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
