import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { EventRegistrationsResponse, OrganizerRegistrationRow } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { Icon } from '../../components/Icon'
import { Loading } from '../../components/Loading'
import { Notice } from '../../components/Notice'
import { PageTop } from '../../components/PageTop'
import { NotFoundPage } from '../../routes/pages/NotFoundPage'
import { seatsLeft } from '../../utils/eventDisplay'
import { formatEventTime } from '../../utils/formatEventTime'
import './Registrations.css'

/** "17:02" in Bangkok time (NFR-11), for the check-in chip and the window message. */
const bangkokClock = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))

type Busy = { id: number; kind: 'in' | 'undo' } | null

/**
 * `/organizer/events/:id/registrations` (Sprint 1 contracts §12 Feature-I): who registered for the organizer's own
 * event, display names only, oldest first. From Sprint 3 it is **Door check-in** (Feature-P, UX-21): while the server
 * says the window is open, each registered row has CHECK IN (E-18) and each checked-in row has Undo (E-19). Another
 * organizer's event and a malformed id show the not-found page (BR-14).
 */
export const Registrations: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<EventRegistrationsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [announce, setAnnounce] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const controls = useRef(new Map<number, HTMLButtonElement>())
  const [focusAfter, setFocusAfter] = useState<number | null>(null)

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

  // Focus stays on the row's new control after a check-in or an undo (contract §1 UI).
  useEffect(() => {
    if (focusAfter === null) return
    controls.current.get(focusAfter)?.focus()
    setFocusAfter(null)
  }, [focusAfter, data])

  const act = async (row: OrganizerRegistrationRow, kind: 'in' | 'undo') => {
    if (busy) return
    setBusy({ id: row.id, kind })
    setActionError(null)
    const url = `/api/organizer/registrations/${row.id}/check-in`
    try {
      const updated = kind === 'in' ? await api.post<OrganizerRegistrationRow>(url, {}) : await api.delete<OrganizerRegistrationRow>(url)
      setData((d) =>
        d && {
          ...d,
          items: d.items.map((r) => (r.id === updated.id ? updated : r)),
          counts: d.counts && { ...d.counts, checkedIn: d.counts.checkedIn + (kind === 'in' ? 1 : -1) },
        },
      )
      const name = row.participant.displayName
      setAnnounce(kind === 'in' ? `${name} checked in.` : `${name}'s check-in was undone.`)
      setFocusAfter(row.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

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

  const { event, items, checkIn, counts } = data
  const needle = query.trim().toLowerCase()
  const shown = needle ? items.filter((r) => r.participant.displayName.toLowerCase().includes(needle)) : items
  const ref = (rowId: number) => (el: HTMLButtonElement | null) => {
    if (el) controls.current.set(rowId, el)
    else controls.current.delete(rowId)
  }

  return (
    <>
      <PageTop
        title={event.title}
        subtitle={
          <>
            <span className="door__label">Door check-in</span>{' '}
            <span className="chip chip--seats">
              {event.registeredCount} / {event.capacity} · {seatsLeft(event.seatsRemaining)}
            </span>
          </>
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
        <div role="status" aria-live="polite" aria-label="Check-in updates" className="sr-only">
          {announce}
        </div>
        {actionError && (
          <div className="page-alerts">
            <Notice tone="error">{actionError}</Notice>
          </div>
        )}
        {items.length === 0 ? (
          <EmptyState
            title="No registrations yet."
            description="When players register for this event, they'll appear here in the order they signed up."
            action={{ label: 'Back to Dashboard', href: '/organizer' }}
          />
        ) : (
          <>
            <div className="door__bar">
              {counts && (
                <p className="door__count">
                  Checked in {counts.checkedIn} / {counts.active}
                </p>
              )}
              {checkIn?.state === 'NOT_YET' && (
                <p className="door__window">Check-in opens at {bangkokClock(checkIn.opensAt)} (60 minutes before the start)</p>
              )}
              {checkIn?.state === 'CLOSED' && <p className="door__window">Check-in closed at {bangkokClock(checkIn.closesAt)}</p>}
              <div className="door__find">
                <label htmlFor="find-player">Find a player</label>
                <input id="find-player" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Player</th>
                    <th scope="col">Registered at</th>
                    <th scope="col">Status</th>
                    {checkIn && <th scope="col">Check-in</th>}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const name = row.participant.displayName
                    const isBusy = busy?.id === row.id
                    return (
                      <tr key={row.id} className={row.status === 'CHECKED_IN' ? 'door__row--in' : undefined}>
                        {/* Numbered among active rows only, so the last number matches the count above. */}
                        <td>{row.status === 'CANCELLED' ? '' : items.filter((r, j) => j <= items.indexOf(row) && r.status !== 'CANCELLED').length}</td>
                        <td>
                          <strong>{name}</strong>
                        </td>
                        <td>
                          <time dateTime={row.createdAt}>{formatEventTime(row.createdAt)}</time>
                        </td>
                        <td>
                          {row.status === 'CANCELLED' ? (
                            <>
                              <span className="chip chip--muted">Cancelled</span>{' '}
                              {row.cancelledAt && <time dateTime={row.cancelledAt}>{formatEventTime(row.cancelledAt)}</time>}
                            </>
                          ) : row.status === 'CHECKED_IN' && row.checkedInAt ? (
                            <span className="chip door__in">
                              <Icon name="check" size="sm" />
                              <span>Checked in {bangkokClock(row.checkedInAt)}</span>
                            </span>
                          ) : (
                            <span className="chip chip--seats">
                              <Icon name="check" size="sm" />
                              {row.status}
                            </span>
                          )}
                        </td>
                        {checkIn && (
                          <td>
                            {checkIn.open && row.status === 'REGISTERED' && (
                              <button
                                ref={ref(row.id)}
                                type="button"
                                className="door__checkin"
                                aria-label={`Check in ${name}`}
                                aria-busy={isBusy ? 'true' : undefined}
                                onClick={() => act(row, 'in')}
                              >
                                {isBusy ? 'Checking in…' : 'CHECK IN'}
                              </button>
                            )}
                            {checkIn.open && row.status === 'CHECKED_IN' && (
                              <button
                                ref={ref(row.id)}
                                type="button"
                                className="door__undo"
                                aria-label={`Undo check-in for ${name}`}
                                aria-busy={isBusy ? 'true' : undefined}
                                onClick={() => act(row, 'undo')}
                              >
                                {isBusy ? 'Undoing…' : 'Undo'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
