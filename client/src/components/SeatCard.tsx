import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { EventDetail } from '../api/types'
import { formatEventTime } from '../utils/formatEventTime'
import { seatLevel, seatsLeft } from '../utils/eventDisplay'
import { Icon } from './Icon'

export interface SeatCardProps {
  event: EventDetail
  /** True after a 201 from E-09 in this visit: the card flips to "You're in." (design-direction §7). */
  secured: boolean
}

/** The Seats card on the event detail page. Two faces; only the visible one is exposed to assistive tech. */
export const SeatCard: React.FC<SeatCardProps> = ({ event, secured }) => {
  const youreIn = useRef<HTMLHeadingElement>(null)
  const filled = Math.min(1, event.registeredCount / event.capacity)
  const level = seatLevel(event)

  // Design-direction §7 step 4: focus moves to "You're in." when the seat is secured.
  useEffect(() => {
    if (secured) youreIn.current?.focus()
  }, [secured])

  const bar = (
    <div className="seat-bar" aria-hidden="true">
      <div className="seat-bar__fill" style={{ transform: `scaleX(${filled})` }} />
    </div>
  )

  return (
    <div className={`seat-card${secured ? ' is-flipped' : ''}`}>
      <div className="seat-card__inner">
        <section className="seat-card__face box" aria-hidden={secured} aria-labelledby="seats-title">
          <h2 id="seats-title" className="seat-card__head">
            Seats
            <span className="tabular-nums">
              {event.registeredCount} / {event.capacity}
            </span>
          </h2>
          {bar}
          <p className={`seat-card__left tabular-nums${level === 'ok' ? '' : ` seat-card__left--${level}`}`}>
            {level === 'full' ? 'No seats left' : seatsLeft(event.seatsRemaining)}
          </p>
          <p className="sub mt-2">Player names are private. Only the organizer of this event can see who registered.</p>
        </section>

        {/* Mounted only once the seat is secured, so the page never shows a hidden second copy of the event. */}
        {secured && (
          <section className="seat-card__face seat-card__back box">
            <h2 ref={youreIn} tabIndex={-1}>
              You're in.
            </h2>
            <p className="seat-card__lead">Your seat at {event.title} is held. See you at the table.</p>
            <dl className="ticket-facts">
              <dt>When</dt>
              <dd>{formatEventTime(event.startAt)}</dd>
              <dt>Where</dt>
              <dd>
                {event.venueName}, {event.city}
              </dd>
              <dt>Seats</dt>
              <dd className="tabular-nums">
                {event.registeredCount} / {event.capacity} taken · {event.seatsRemaining} left
              </dd>
            </dl>
            {bar}
            <p className="seat-card__note">Check in at the counter when you arrive.</p>
            <Link to="/me/registrations" className="seat-card__link">
              See it in My Events
              <Icon name="arrow" size="sm" />
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}
