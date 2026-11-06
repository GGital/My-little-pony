import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ApiError } from '../api/errors'
import type { EventDetail as EventDetailType, ParticipantRegistration } from '../api/types'
import { ActionButton } from '../components/ActionButton'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { SeatCard } from '../components/SeatCard'
import { NotFoundPage } from '../routes/pages/NotFoundPage'
import { formatEventTime } from '../utils/formatEventTime'

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
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
    return <Loading />
  }

  if (notFound) {
    return <NotFoundPage />
  }

  if (error || !event) {
    return <ErrorState message={error ?? 'Event not found.'} onRetry={fetchDetail} />
  }

  return (
    <div className="container py-4">
      <div aria-live="polite" className="visually-hidden-live">
        {announcement}
      </div>
      {alert && (
        <div className="alert alert-danger" role="alert">
          {alert}
        </div>
      )}
      {/* Event Header Banner */}
      <div className="card p-4 shadow-sm mb-4 border-0">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <h1 className="fw-bold mb-1">{event.title}</h1>
            <div className="text-muted mb-3">
              at {event.organizer.displayName} · {event.city}
            </div>

            <div className="d-flex gap-4 flex-wrap text-secondary small">
              <div>
                <span className="fw-bold text-uppercase d-block">Date & Time</span>
                <span>{formatEventTime(event.startAt)}</span>
              </div>
              <div>
                <span className="fw-bold text-uppercase d-block">Players</span>
                <span>
                  {event.registeredCount} / {event.capacity}
                </span>
              </div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-end">
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
      </div>

      {/* Two Column Layout (contracts 9, design-direction 5.2) */}
      <div className="row g-4">
        {/* Left Column: Details & Description */}
        <div className="col-lg-8">
          <div className="card p-4 shadow-sm border-0 mb-4">
            <h4 className="fw-bold mb-3">Event Details</h4>

            <div className="d-flex gap-2 mb-3">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                {event.type}
              </span>
              <span className="badge bg-secondary-subtle text-secondary-emphasis">
                {event.format}
              </span>
              {event.feeLabel && (
                <span className="badge bg-light text-dark border">
                  {event.feeLabel}
                </span>
              )}
            </div>

            {event.structureNote && (
              <div className="mb-3">
                <span className="fw-bold d-block small text-muted">Structure</span>
                <span>{event.structureNote}</span>
              </div>
            )}

            <div className="mb-3">
              <span className="fw-bold d-block small text-muted">Venue Address</span>
              <span>{event.venueAddress}</span>
            </div>

            {event.contact && (
              <div className="mb-3">
                <span className="fw-bold d-block small text-muted">Contact</span>
                <span>{event.contact}</span>
              </div>
            )}

            {event.description && (
              <div className="mt-4">
                <span className="fw-bold d-block small text-muted mb-2">Description</span>
                {/* Safe rendering as plain text (AC-C-06, NFR-15) */}
                <p className="text-secondary mb-0" style={{ whiteSpace: 'pre-line' }}>
                  {event.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Seats Panel */}
        <div className="col-lg-4">
          <SeatCard event={event} secured={secured} />
          <div className="mt-3">
            {event.viewer.action === 'MANAGE' && (
              <div className="mt-2 pt-2 border-top">
                <Link
                  to={`/organizer/events/${event.id}/registrations`}
                  className="btn btn-sm btn-outline-secondary w-100"
                >
                  View registrations
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
