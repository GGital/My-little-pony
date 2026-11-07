import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ParticipantRegistration } from '../api/types'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { EmptyState } from '../components/EmptyState'
import { EventCard } from '../components/EventCard'
import { Icon } from '../components/Icon'
import { EVENT_TABS, PageTop } from '../components/PageTop'

/** `/me/registrations` (contracts §11): the participant's own registrations, soonest first, as event cards. */
export const MyEvents: React.FC = () => {
  const [items, setItems] = useState<ParticipantRegistration[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setItems(null)
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
        {error ? (
          <ErrorState message={error} onRetry={load} />
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
              {items.map(({ id, status, event }) => (
                <EventCard
                  key={id}
                  event={event}
                  to={`/events/${event.id}`}
                  aside={
                    <span className="chip chip--seats">
                      <Icon name="check" size="sm" />
                      {status}
                    </span>
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
