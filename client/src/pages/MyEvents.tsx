import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ParticipantRegistration } from '../api/types'
import { CancelRegistrationDialog } from '../components/CancelRegistrationDialog'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { EmptyState } from '../components/EmptyState'
import { EventCard } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import { EVENT_TABS, PageTop } from '../components/PageTop'
import { formatEventTime } from '../utils/formatEventTime'
import './MyEvents.css'

/** `/me/registrations` (contracts §11): the participant's own registrations, soonest first, as event cards. */
export const MyEvents: React.FC = () => {
  const [items, setItems] = useState<ParticipantRegistration[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Sprint 2 Feature-N: the row whose Cancel registration dialog is open, the success toast and the 409 alert.
  const [cancelling, setCancelling] = useState<ParticipantRegistration | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [alert, setAlert] = useState<string | null>(null)

  /** `silent` reloads the rows after a 409 without replacing the page by the loading state. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setItems(null)
    setError(null)
    try {
      setItems((await api.get<{ items: ParticipantRegistration[] }>('/api/me/registrations')).items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <PageTop title="My Events" tabs={EVENT_TABS} />
      <div className="pbody">
        {(toast || alert) && (
          <div className="page-alerts">
            {toast && (
              <Notice tone="success" onClose={() => setToast(null)}>
                {toast}
              </Notice>
            )}
            {alert && <Notice tone="error">{alert}</Notice>}
          </div>
        )}
        {cancelling && (
          <CancelRegistrationDialog
            registrationId={cancelling.id}
            eventTitle={cancelling.event.title}
            onClose={() => setCancelling(null)}
            onCancelled={(done) => {
              setItems((rows) => rows?.map((r) => (r.id === done.id ? done : r)) ?? rows)
              setCancelling(null)
              setAlert(null)
              setToast('Your registration is cancelled.')
            }}
            onFailed={(message) => {
              setCancelling(null)
              setToast(null)
              setAlert(message)
              load(true)
            }}
          />
        )}
        {error ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : !items ? (
          <Loading label="Loading your events…" cards={2} />
        ) : items.length === 0 ? (
          <EmptyState
            title="You haven't registered for any events yet"
            description="Pick an event, press Register, and it shows up here."
            action={{ label: 'Find an Event', href: '/events' }}
          />
        ) : (
          <>
            <div className="listhead">
              <h2>Your registrations</h2>
              <span className="lbl">Soonest first</span>
            </div>
            <div className="stack">
              {items.map((registration) => {
                const { id, status, event, cancelledAt, canCancel } = registration
                return (
                  <div key={id} className="registration-row">
                    <EventCard
                      event={event}
                      to={`/events/${event.id}`}
                      aside={
                        status === 'EVENT_CANCELLED' ? (
                          <span className="chip chip--cancelled">
                            <Icon name="alert" size="sm" />
                            Event cancelled
                          </span>
                        ) : status === 'CANCELLED' ? (
                          <>
                            <span className="chip chip--muted">Cancelled</span>
                            {cancelledAt && (
                              <time className="event-card__note tabular-nums" dateTime={cancelledAt}>
                                {formatEventTime(cancelledAt)}
                              </time>
                            )}
                          </>
                        ) : (
                          <span className="chip chip--seats">
                            <Icon name="check" size="sm" />
                            {status}
                          </span>
                        )
                      }
                    />
                    {/* The card is one link, so its button sits under it instead of inside it. */}
                    {canCancel && (
                      <div className="registration-row__actions">
                        <button type="button" className="btn-soft btn-soft--danger" onClick={() => setCancelling(registration)}>
                          Cancel registration
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
