import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { EventDetail, EventSummary } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { EventCard, SeatsChip } from '../../components/EventCard'
import { Icon } from '../../components/Icon'
import { Loading } from '../../components/Loading'
import { Notice } from '../../components/Notice'
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
  // Sprint 2 Feature-K (UX-15): Publish on a draft row, then a toast or the server's reason.
  const [publishing, setPublishing] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

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

  const publish = async (event: EventSummary) => {
    if (publishing !== null) return
    setPublishing(event.id)
    setNotice(null)
    try {
      const published = await api.post<EventDetail>(`/api/organizer/events/${event.id}/publish`)
      setItems((list) => list && list.map((e) => (e.id === event.id ? { ...e, status: published.status } : e)))
      setNotice({ tone: 'success', text: 'Your event is live.' })
    } catch (err) {
      const text = err instanceof ApiError ? [err.message, ...(err.details ?? []).map((d) => d.message)].join(' ') : 'Something went wrong. Please try again.'
      setNotice({ tone: 'error', text })
    } finally {
      setPublishing(null)
    }
  }

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
        {notice && (
          <div className="page-alerts">
            <Notice tone={notice.tone} onClose={() => setNotice(null)}>
              {notice.text}
            </Notice>
          </div>
        )}
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
                      <span className={`chip ${event.status === 'CANCELLED' ? 'chip--cancelled' : 'chip--muted'}`}>{STATUS_LABEL[event.status] ?? event.status}</span>
                      <SeatsChip event={event} />
                    </div>
                    <span className="event-card__note tabular-nums">{seatsLeft(event.seatsRemaining)}</span>
                    <div className="event-card__actions">
                      {event.status === 'DRAFT' ? (
                        <button
                          type="button"
                          className="btn-soft btn-soft--primary"
                          onClick={() => void publish(event)}
                          disabled={publishing !== null}
                          aria-busy={publishing === event.id}
                          aria-label={`Publish ${event.title}`}
                        >
                          {publishing === event.id ? 'Publishing…' : 'Publish'}
                        </button>
                      ) : (
                        <Link
                          to={`/organizer/events/${event.id}/registrations`}
                          className="btn-soft btn-soft--primary"
                          aria-label={`Registrations for ${event.title}`}
                        >
                          Registrations
                        </Link>
                      )}
                      {event.status !== 'CANCELLED' && (
                        <Link to={`/organizer/events/${event.id}/edit`} className="btn-soft" aria-label={`Edit ${event.title}`}>
                          Edit
                        </Link>
                      )}
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
