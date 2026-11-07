import React, { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ApiError } from '../api/errors'
import type { EventDetail as EventDetailType, ParticipantRegistration } from '../api/types'
import { ActionButton } from '../components/ActionButton'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { SeatCard } from '../components/SeatCard'
import { NotFoundPage } from '../routes/pages/NotFoundPage'
import { Icon, type IconName } from '../components/Icon'
import { Notice } from '../components/Notice'
import { formatDate, formatTimeRange, label } from '../utils/eventDisplay'

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [toastMessage, setToastMessage] = useState<string | null>(() => (location.state as { toast?: string } | null)?.toast ?? null)

  useEffect(() => {
    if ((location.state as { toast?: string } | null)?.toast) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [navigate, location.pathname, location.state])
  const [event, setEvent] = useState<EventDetailType | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState<boolean>(false)
  const [registering, setRegistering] = useState(false)
  const [secured, setSecured] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  /** `silent` refreshes the counts after a 409 without replacing the page by the loading state. */
  const fetchDetail = useCallback(async (silent = false) => {
    if (!id || !/^[1-9]\d*$/.test(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const data = await api.get<EventDetailType>(`/api/events/${id}`, { auth: 'optional' })
      setEvent(data)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
        setNotFound(true)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load event details.')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  // Contracts §10 Behaviour 1–4: E-09, then the "seat secured" moment on 201, or the server's reason on 409.
  const onRegister = async () => {
    if (!event || registering) return
    setRegistering(true)
    setAlert(null)
    try {
      const registration = await api.post<ParticipantRegistration>(`/api/events/${event.id}/registrations`)
      const { registeredCount, seatsRemaining } = registration.event
      setEvent({ ...event, registeredCount, seatsRemaining, viewer: { action: 'REGISTERED', registrationId: registration.id } })
      setSecured(true)
      setAnnouncement(
        `You're registered for ${event.title}. ${seatsRemaining} seat${seatsRemaining === 1 ? '' : 's'} left.`
      )
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      await fetchDetail(true)
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return <Loading label="Loading event…" />
  }

  if (notFound) {
    return <NotFoundPage />
  }

  if (error || !event) {
    return <ErrorState message={error ?? 'Event not found.'} onRetry={fetchDetail} />
  }

  const info = (icon: IconName, content: React.ReactNode) => (
    <div className="info-row">
      <div className="ico">
        <Icon name={icon} />
      </div>
      <div>{content}</div>
    </div>
  )

  return (
    <>
      <div aria-live="polite" className="visually-hidden-live">
        {announcement}
      </div>
      {(toastMessage || alert) && (
        <div className="page-alerts">
          {toastMessage && (
            <Notice tone="success" onClose={() => setToastMessage(null)}>
              {toastMessage}
            </Notice>
          )}
          {alert && <Notice tone="error">{alert}</Notice>}
        </div>
      )}

      {/* Header row: title, host, date, time, players, one wide action (design-direction §5.2). */}
      <div className="dhead">
        <div className="dhead__title">
          <h1>{event.title}</h1>
          <p className="host">
            at <strong>{event.venueName}</strong> · {event.city}
          </p>
        </div>
        <div>
          <div className="lbl">Date</div>
          <div className="dhead__fact">{formatDate(event.startAt)}</div>
        </div>
        <div>
          <div className="lbl">Time</div>
          <div className="dhead__fact tabular-nums">{formatTimeRange(event.startAt, event.endAt)}</div>
        </div>
        <div>
          <div className="lbl">Players</div>
          <div className="dhead__fact tabular-nums">
            {event.registeredCount} / {event.capacity}
          </div>
        </div>
        <div className="dhead__action">
          <ActionButton
            action={event.viewer.action}
            eventId={event.id}
            registrationId={event.viewer.registrationId}
            capacity={event.capacity}
            registeredCount={event.registeredCount}
            onRegister={onRegister}
            busy={registering}
          />
        </div>
      </div>

      <div className="cols">
        <div className="cols__main">
          <section className="box details-box">
            <h2>Event details</h2>
            <span className="pill">{label(event.type)}</span>
            {info(
              'cal',
              <>
                {formatDate(event.startAt)}
                <br />
                <span className="tabular-nums">{formatTimeRange(event.startAt, event.endAt)}</span> (Bangkok time)
              </>
            )}
            {info('pin', event.venueAddress)}
            {info(
              'trophy',
              <>
                {label(event.format)}
                {event.structureNote && (
                  <>
                    <br />
                    {event.structureNote}
                  </>
                )}
              </>
            )}
            {info('fee', event.feeLabel || 'Free')}
            {/* Plain text only: the description is never parsed as HTML (AC-C-06, NFR-15). */}
            {event.description && <p className="description">{event.description}</p>}
          </section>

          {event.contact && (
            <section className="box contact-box">
              <h2>Contact</h2>
              {info('mail', event.contact)}
            </section>
          )}
        </div>

        <div className="cols__side">
          <SeatCard event={event} secured={secured} />
          {event.viewer.action === 'MANAGE' && (
            <section className="box manage-box">
              <h2>Your event</h2>
              <p className="sub mb-3">You can see who registered. Players only see the seat count.</p>
              <Link to={`/organizer/events/${event.id}/registrations`} className="btn-soft">
                View registrations
                <Icon name="arrow" size="sm" />
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
