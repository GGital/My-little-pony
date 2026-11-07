import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { EventRegistrationsResponse } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { Icon } from '../../components/Icon'
import { Loading } from '../../components/Loading'
import { PageTop } from '../../components/PageTop'
import { NotFoundPage } from '../../routes/pages/NotFoundPage'
import { seatsLeft } from '../../utils/eventDisplay'
import { formatEventTime } from '../../utils/formatEventTime'

/**
 * `/organizer/events/:id/registrations` (contracts §12 Feature-I): who registered for the organizer's own event,
 * display names only, oldest first. Another organizer's event and a malformed id show the not-found page (BR-14).
 */
export const Registrations: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<EventRegistrationsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setData(null)
    setError(null)
    setNotFound(false)
    try {
      setData(await api.get<EventRegistrationsResponse>(`/api/organizer/events/${id}/registrations`))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setNotFound(true)
      else setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (notFound) return <NotFoundPage />

  if (error || !data) {
    return (
      <>
        <PageTop title="Registrations" />
        <div className="pbody">
          {error ? <ErrorState message={error} onRetry={load} /> : <Loading label="Loading registrations…" />}
        </div>
      </>
    )
  }

  const { event, items } = data

  return (
    <>
      <PageTop
        title={event.title}
        subtitle={
          <span className="chip chip--seats">
            {event.registeredCount} / {event.capacity} · {seatsLeft(event.seatsRemaining)}
          </span>
        }
        action={
          <div className="ptop__actions">
            <Link to={`/events/${event.id}`} className="btn-soft" aria-label={`View ${event.title}`}>
              View event
            </Link>
            <Link to="/organizer" className="btn-soft">
              Dashboard
            </Link>
          </div>
        }
      />
      <div className="pbody">
        {items.length === 0 ? (
          <EmptyState
            title="No registrations yet."
            description="When players register for this event, they'll appear here in the order they signed up."
            action={{ label: 'Back to Dashboard', href: '/organizer' }}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Player</th>
                  <th scope="col">Registered at</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.id}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{row.participant.displayName}</strong>
                    </td>
                    <td>
                      <time dateTime={row.createdAt}>{formatEventTime(row.createdAt)}</time>
                    </td>
                    <td>
                      <span className="chip chip--seats">
                        <Icon name="check" size="sm" />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
