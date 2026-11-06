import React from 'react'
import { Link } from 'react-router-dom'
import type { EventSummary } from '../api/types'
import { formatEventTime } from '../utils/formatEventTime'
import { dateBadge, label, seatLevel, seatsLeft } from '../utils/eventDisplay'
import { Icon } from './Icon'

/** Seats chip: teal, amber when few are left, red FULL at 0 (design-direction §5.1). */
export const SeatsChip: React.FC<{ event: EventSummary }> = ({ event }) => {
  const level = seatLevel(event)
  const count = `${event.registeredCount} / ${event.capacity}`
  if (level === 'full') return <span className="chip chip--full">FULL {count}</span>
  return (
    <span className={`chip ${level === 'low' ? 'chip--low' : 'chip--seats'}`}>
      <Icon name="users" size="sm" />
      {count}
    </span>
  )
}

/** Fee chip, then seats chip, then "n seats left" (unless full). */
export const DefaultAside: React.FC<{ event: EventSummary }> = ({ event }) => (
  <>
    <div className="chips">
      <span className="chip">{event.feeLabel || 'Free'}</span>
      <SeatsChip event={event} />
    </div>
    {event.seatsRemaining > 0 && <span className="event-card__note tabular-nums">{seatsLeft(event.seatsRemaining)}</span>}
  </>
)

export interface EventCardProps {
  event: EventSummary
  /** When set, the whole card is one link (design-direction §5.1). Leave it out when the card holds its own links. */
  to?: string
  /** Right-hand column; the fee and seats chips by default. */
  aside?: React.ReactNode
}

/** One event in a list: date badge, weekday · time, title, type · format, venue · city, chips. */
export const EventCard: React.FC<EventCardProps> = ({ event, to, aside }) => {
  const badge = dateBadge(event.startAt)
  const body = (
    <>
      <div className="date-badge" aria-hidden="true">
        <span className="date-badge__month">{badge.month}</span>
        <span className="date-badge__day">{badge.day}</span>
      </div>
      <div>
        <div className="event-card__when">{formatEventTime(event.startAt)}</div>
        <h3 className="event-card__title">{event.title}</h3>
        <div className="event-card__sub">
          {label(event.type)} · {label(event.format)}
        </div>
        <div className="event-card__venue">
          {event.venueName} · {event.city}
        </div>
      </div>
      <div className="event-card__aside">{aside ?? <DefaultAside event={event} />}</div>
    </>
  )
  return to ? (
    <Link to={to} className="event-card">
      {body}
    </Link>
  ) : (
    <article className="event-card">{body}</article>
  )
}
