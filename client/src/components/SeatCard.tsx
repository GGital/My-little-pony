import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { EventDetail } from '../api/types'
import { formatEventTime } from '../utils/formatEventTime'

export interface SeatCardProps {
  event: EventDetail
  /** True after a 201 from E-09 in this visit: the card flips to "You're in." (design-direction §7). */
  secured: boolean
}

const seatsLeft = (n: number) => `${n} seat${n === 1 ? '' : 's'} left`

/** The Seats card on the event detail page. Two faces; only the visible one is exposed to assistive tech. */
export const SeatCard: React.FC<SeatCardProps> = ({ event, secured }) => {
  const youreIn = useRef<HTMLHeadingElement>(null)
  const filled = Math.min(1, event.registeredCount / event.capacity)

  // Design-direction §7 step 4: focus moves to "You're in." when the seat is secured.
  useEffect(() => {
    if (secured) youreIn.current?.focus()
  }, [secured])

  const bar = (
    <div className="seat-bar mb-3" aria-hidden="true">
      <div className="seat-bar__fill" style={{ transform: `scaleX(${filled})` }} />
    </div>
  )

  return (
    <div className={`seat-card${secured ? ' is-flipped' : ''}`}>
      <div className="seat-card__inner">
        <div className="seat-card__face card p-4 shadow-sm border-0" aria-hidden={secured}>
          <h4 className="fw-bold mb-2">Seats</h4>
          <div className="d-flex justify-content-between align-items-baseline mb-2">
            <span className="fs-4 fw-bold tabular-nums">
              {event.registeredCount} / {event.capacity}
            </span>
            <span className="text-muted small">{seatsLeft(event.seatsRemaining)}</span>
          </div>
          {bar}
          <p className="text-muted small mb-0">Player names are private.</p>
        </div>

        {/* Mounted only once the seat is secured, so the page never shows a hidden second copy of the event. */}
        {secured && (
        <div className="seat-card__face seat-card__back card p-4 shadow-sm border-0">
          <h4 ref={youreIn} tabIndex={-1} className="fw-bold mb-1">
            You're in.
          </h4>
          <p className="mb-1 fw-semibold">{event.title}</p>
          <p className="text-muted small mb-2">
            {formatEventTime(event.startAt)} · {event.venueName}
          </p>
          <p className="mb-2 tabular-nums">
            {event.registeredCount} / {event.capacity} taken · {event.seatsRemaining} left
          </p>
          {bar}
          <p className="text-muted small mb-2">Check in at the counter when you arrive. See you at the table.</p>
          <Link to="/me/registrations">See it in My Events</Link>
        </div>
        )}
      </div>
    </div>
  )
}
