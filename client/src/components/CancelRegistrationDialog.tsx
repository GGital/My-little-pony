import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { ApiError } from '../api/errors'
import type { ParticipantRegistration } from '../api/types'

export interface CancelRegistrationDialogProps {
  registrationId: number
  eventTitle: string
  onClose: () => void
  /** Called with the cancelled registration returned by E-16. */
  onCancelled: (registration: ParticipantRegistration) => void
  /** Called with the server's message when E-16 refuses (409) or fails. */
  onFailed: (message: string) => void
}

/**
 * Confirmation dialog for cancelling a seat (Sprint 2 contracts §5, UX-11). "Keep my seat" is the safe default and
 * has focus first. The button shows "Cancelling…" with aria-busy and extra presses are ignored while E-16 is sent.
 */
export const CancelRegistrationDialog: React.FC<CancelRegistrationDialogProps> = ({
  registrationId,
  eventTitle,
  onClose,
  onCancelled,
  onFailed,
}) => {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const keep = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  // Same native modal <dialog> handling as CancelEventDialog: inert page behind, Escape handled, focus returned.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = dialog.current
    if (el && typeof el.showModal === 'function') el.showModal()
    else el?.setAttribute('open', '')
    keep.current?.focus()
    return () => {
      if (el?.open && typeof el.close === 'function') el.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const confirm = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      onCancelled(await api.post<ParticipantRegistration>(`/api/me/registrations/${registrationId}/cancel`))
    } catch (err) {
      onFailed(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <dialog
      ref={dialog}
      className="dialog box"
      aria-labelledby="cancel-registration-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          if (!busy) onClose()
        }
      }}
    >
      <h2 id="cancel-registration-title">Cancel registration?</h2>
      <p className="sub">Cancel your seat at {eventTitle}? You can register again while seats are left.</p>
      <div className="dialog__actions">
        <button ref={keep} type="button" className="btn-soft" onClick={onClose} disabled={busy}>
          Keep my seat
        </button>
        <button type="button" className="btn-danger" onClick={confirm} disabled={busy} aria-busy={busy}>
          {busy ? 'Cancelling…' : 'Cancel registration'}
        </button>
      </div>
    </dialog>
  )
}
