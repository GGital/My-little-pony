import React from 'react'
import type { EventDetail } from '../api/types'
import { gameLabel } from '../utils/games'
import './StoreHost.css'

/** The website's host name only, "quantumcards.example"; the link keeps the full address. */
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * The host section of the event page (Feature-U, UX-17, UX-19, D-37): the store, the games it plays and its public
 * contact details on every event, with the event's own contact first. Every value is React text, never HTML (NFR-15).
 */
export const StoreHost: React.FC<{ event: EventDetail }> = ({ event }) => {
  const store = event.store
  const contact = store?.contact
  const hasContact = !!contact && !!(contact.phone || contact.email || contact.website || contact.line)
  // Nothing to show (no games, no contact details, no contact of its own): no section at all (contracts §11.1).
  if (!(store?.games && store.games.length > 0) && !hasContact && !event.contact) return null
  return (
    <section className="box contact-box store-host">
      <h2>Hosted by {store?.displayName ?? event.organizer.displayName}</h2>
      {store?.games && store.games.length > 0 && (
        <div className="store-host__games" aria-label="Games played here">
          {store.games.map((g) => (
            <span key={g} className="chip">
              {gameLabel(g)}
            </span>
          ))}
        </div>
      )}
      {event.contact && <p className="store-host__own">Contact for this event: {event.contact}</p>}
      {hasContact && contact && (
        <ul className="store-host__list">
          {contact.phone && (
            <li>
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
            </li>
          )}
          {contact.email && (
            <li>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
          )}
          {contact.website && (
            <li>
              <a href={contact.website} target="_blank" rel="noopener noreferrer nofollow">
                {hostOf(contact.website)}
              </a>
            </li>
          )}
          {contact.line && (
            <li>
              <span className="store-host__label">LINE</span>
              <span>{contact.line}</span>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
