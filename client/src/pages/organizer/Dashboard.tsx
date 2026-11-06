import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { EventSummary } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { EventCard, SeatsChip } from '../../components/EventCard'
import { Icon } from '../../components/Icon'
import { Loading } from '../../components/Loading'
import { PageTop } from '../../components/PageTop'
import { seatsLeft } from '../../utils/eventDisplay'

const STATUS_LABEL: Record<EventSummary['status'], string> = {
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  CANCELLED: 'Cancelled',
}

/**
 * `/organizer` (contracts §8 Feature-E): lists the signed-in organizer's own events,
 * earliest start first (all of them: upcoming and started).
 */
export const Dashboard: React.FC = () => {
  const [items, setItems] = useState<EventSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setItems(null)
    setError(null)
    try {
      const data = await api.get<{ items: EventSummary[] }>('/api/organizer/events')
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = (
    <Link to="/organizer/events/new" className="btn-big">
      <Icon name="plus" />
      Create event
    </Link>
  )

  return (
    <>
      <PageTop title="Dashboard" subtitle="Your events, earliest first, with live seat counts." action={items?.length ? create : undefined} />
      <div className="pbody">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !items ? (
          <Loading label="Loading your events…" cards={3} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Create your first event"
            description="Schedule a tournament, casual play or release event. Players can register as soon as it's published."
            action={{ label: '+ Create event', href: '/organizer/events/new' }}
          />
        ) : (
          <div className="stack">
            {items.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                aside={
                  <>
                    <div className="chips">
                      <span className="chip chip--muted">{STATUS_LABEL[event.status] ?? event.status}</span>
                      <SeatsChip event={event} />
                    </div>
                    <span className="event-card__note tabular-nums">{seatsLeft(event.seatsRemaining)}</span>
                    <div className="event-card__actions">
                      <Link
                        to={`/organizer/events/${event.id}/registrations`}
                        className="btn-soft btn-soft--primary"
                        aria-label={`Registrations for ${event.title}`}
                      >
                        Registrations
                      </Link>
                      <Link to={`/events/${event.id}`} className="btn-soft" aria-label={`View ${event.title}`}>
                        View
                      </Link>
                    </div>
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
