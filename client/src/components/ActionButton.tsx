import React from 'react'
import { Link } from 'react-router-dom'
import type { ViewerAction } from '../api/types'

export interface ActionButtonProps {
  action: ViewerAction
  eventId: number
  registrationId?: number | null
  capacity?: number
  registeredCount?: number
  onRegister?: () => void
  /** E-09 in flight: REGISTER reads HOLDING YOUR SEAT… and ignores presses (contracts §10 Behaviour 1). */
  busy?: boolean
  disabled?: boolean
  className?: string
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  eventId,
  capacity,
  onRegister,
  busy = false,
  disabled,
  className = '',
}) => {
  switch (action) {
    case 'SIGN_IN_TO_REGISTER': {
      const returnTo = encodeURIComponent(`/events/${eventId}`)
      return (
        <Link
          to={`/login?returnTo=${returnTo}`}
          className={`btn btn-primary ${className}`}
          role="link"
        >
          SIGN IN TO REGISTER
        </Link>
      )
    }

    case 'REGISTER':
      return (
        <button
          type="button"
          className={`btn btn-primary ${className}`}
          onClick={busy ? undefined : onRegister}
          disabled={disabled || busy}
          aria-busy={busy}
        >
          {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
          {busy ? 'HOLDING YOUR SEAT…' : 'REGISTER'}
        </button>
      )

    case 'REGISTERED':
      return (
        <div className="d-flex flex-column align-items-start gap-1">
          <button
            type="button"
            className={`btn btn-outline-success ${className}`}
            disabled
          >
            ✓ REGISTERED
          </button>
          <Link to="/me/registrations" className="text-muted small">
            See it in My Events
          </Link>
        </div>
      )

    case 'ORGANIZER_CANNOT_REGISTER':
      return (
        <span className="text-muted small">
          Organizer accounts can't register for events
        </span>
      )

    case 'MANAGE':
      return (
        <Link
          to={`/organizer/events/${eventId}/registrations`}
          className={`btn btn-outline-primary ${className}`}
          role="link"
        >
          MANAGE EVENT
        </Link>
      )

    case 'FULL':
      return (
        <div className="d-flex flex-column align-items-start gap-1">
          <button
            type="button"
            className={`btn btn-secondary ${className}`}
            disabled
          >
            FULL
          </button>
          {capacity !== undefined && (
            <span className="text-muted small">All {capacity} seats are taken</span>
          )}
        </div>
      )

    case 'CLOSED':
      return (
        <button
          type="button"
          className={`btn btn-secondary ${className}`}
          disabled
        >
          REGISTRATION CLOSED
        </button>
      )

    default:
      return null
  }
}
