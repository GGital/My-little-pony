import React from 'react'
import { Link } from 'react-router-dom'
import type { ViewerAction } from '../api/types'
import { Icon } from './Icon'

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
  const cls = (variant = '') => `btn-big${variant} ${className}`.trim()
  switch (action) {
    case 'SIGN_IN_TO_REGISTER': {
      const returnTo = encodeURIComponent(`/events/${eventId}`)
      return (
        <Link to={`/login?returnTo=${returnTo}`} className={cls()}>
          SIGN IN TO REGISTER
        </Link>
      )
    }

    case 'REGISTER':
      return (
        <button
          type="button"
          className={cls()}
          onClick={busy ? undefined : onRegister}
          disabled={disabled || busy}
          aria-busy={busy}
        >
          {busy && <Icon name="spin" spin />}
          {busy ? 'HOLDING YOUR SEAT…' : 'REGISTER'}
        </button>
      )

    case 'REGISTERED':
      return (
        <>
          <button type="button" className={cls(' btn-big--registered')} disabled>
            <Icon name="check" />
            REGISTERED
          </button>
          <Link to="/me/registrations" className="action-note">
            See it in My Events
          </Link>
        </>
      )

    case 'ORGANIZER_CANNOT_REGISTER':
      return <p className="action-note">Organizer accounts can't register for events</p>

    case 'MANAGE':
      return (
        <Link to={`/organizer/events/${eventId}/registrations`} className={cls(' btn-big--outline')}>
          MANAGE EVENT
        </Link>
      )

    case 'FULL':
      return (
        <>
          <button type="button" className={cls()} disabled>
            FULL
          </button>
          {capacity !== undefined && <p className="action-note">All {capacity} seats are taken</p>}
        </>
      )

    case 'CLOSED':
      return (
        <button type="button" className={cls()} disabled>
          REGISTRATION CLOSED
        </button>
      )

    default:
      return null
  }
}
