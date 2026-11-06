import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { EventRegistrationsResponse } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { PageTop } from '../../components/PageTop'
import { seatsLeft } from '../../utils/eventDisplay'
import { formatEventTime } from '../../utils/formatEventTime'

/**
 * `/organizer/events/:id/registrations` (contracts §12 Feature-I):
 * Lists registrations for an organizer's own event (display names only, oldest first).
 */
export const Registrations: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<EventRegistrationsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setData(null)
    setError(null)
    try {
      const res = await api.get<EventRegistrationsResponse>(`/api/organizer/events/${id}/registrations`)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <>
        <PageTop title="Registrations" subtitle="Error loading registrations" />
        <div className="pbody">
          <ErrorState message={error} onRetry={load} />
        </div>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <PageTop title="Registrations" subtitle="Loading event details…" />
        <div className="pbody">
          <Loading label="Loading registrations…" cards={3} />
        </div>
      </>
    )
  }

  const { event, items } = data

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Link to={`/events/${event.id}`} className="btn-soft" aria-label={`View ${event.title}`}>
        View
      </Link>
      <Link to="/organizer" className="btn-soft">
        Dashboard
      </Link>
    </div>
  )

  return (
    <>
      <PageTop
        title={event.title}
        subtitle={
          <span className="chip chip--seats tabular-nums">
            {event.registeredCount} / {event.capacity} · {seatsLeft(event.seatsRemaining)}
          </span>
        }
        action={actions}
      />
      <div className="pbody">
        {items.length === 0 ? (
          <EmptyState
            title="No registrations yet."
            description="When players register for this event, they'll appear here in the order they signed up."
            action={{ label: 'Back to Dashboard', href: '/organizer' }}
          />
        ) : (
          <div className="box" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', margin: 0, textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase' }}>#</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase' }}>Player</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase' }}>Registered at</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px' }} className="tabular-nums">{idx + 1}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 600 }}>{row.participant.displayName}</td>
                    <td style={{ padding: '16px 20px' }} className="tabular-nums">{formatEventTime(row.createdAt)}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className="chip chip--seats">{row.status}</span>
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
