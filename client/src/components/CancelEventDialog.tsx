import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { ApiError } from '../api/errors'
import type { EventDetail } from '../api/types'
import { Notice } from './Notice'

const REASON_MIN = 5
const REASON_MAX = 200

export interface CancelEventDialogProps {
  eventId: number
  /** Active registrations, so the owner sees how many players are affected (UX-12). */
  registeredCount: number
  onClose: () => void
  /** Called with the cancelled event returned by E-15. */
  onCancelled: (event: EventDetail) => void
}

/**
 * Cancel dialog (Sprint 2 contracts §6, UX-12): a required reason of 5–200 characters with a counter, the number of
 * affected players, and a red CANCEL EVENT button that stays disabled until the reason is long enough. The server
 * repeats every rule; its message is shown if it refuses.
 */
export const CancelEventDialog: React.FC<CancelEventDialogProps> = ({ eventId, registeredCount, onClose, onCancelled }) => {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  // A native modal <dialog>: showModal() makes the page behind it inert, so Tab stays inside it, and the browser
  // handles Escape. Focus goes back to the button that opened the dialog when it unmounts (keyboard use).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = dialog.current
    // jsdom (the client unit tests) has no showModal(); every real browser does.
    if (el && typeof el.showModal === 'function') el.showModal()
    else el?.setAttribute('open', '')
    box.current?.focus()
    return () => {
      if (el?.open && typeof el.close === 'function') el.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const valid = reason.trim().length >= REASON_MIN
  const players = `${registeredCount} registered player${registeredCount === 1 ? '' : 's'}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      onCancelled(await api.post<EventDetail>(`/api/organizer/events/${eventId}/cancel`, { reason: reason.trim() }))
    } catch (err) {
      setError(
        err instanceof ApiError
          ? [err.message, ...(err.details ?? []).map((d) => d.message)].join(' ')
          : 'Something went wrong. Please try again.',
      )
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="dialog box"
      aria-labelledby="cancel-dialog-title"
      onCancel={(e) => {
        // Escape: leave through our own state so the unmount returns focus; ignore it while the request is sent.
        e.preventDefault()
        if (!busy) onClose()
      }}
      onKeyDown={(e) => {
        // Browsers without the 'cancel' event (and jsdom) still get Escape.
        if (e.key === 'Escape') {
          e.preventDefault()
          if (!busy) onClose()
        }
      }}
    >
      <form onSubmit={submit} noValidate>
        <h2 id="cancel-dialog-title">Cancel this event?</h2>
        <p className="sub">This can&apos;t be undone. All {players} will see the event as cancelled.</p>

        <label htmlFor="cancel-reason" className="lbl dialog__label">
          Reason
        </label>
        <textarea
          id="cancel-reason"
          ref={box}
          className="form-control"
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
          aria-describedby="cancel-reason-help"
        />
        <p id="cancel-reason-help" className="dialog__help tabular-nums">
          Players will see this reason. {REASON_MIN}–{REASON_MAX} characters.{' '}
          <span>
            {reason.length} / {REASON_MAX}
          </span>
        </p>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="dialog__actions">
          <button type="button" className="btn-soft" onClick={onClose} disabled={busy}>
            Keep event
          </button>
          <button type="submit" className="btn-danger" disabled={!valid || busy} aria-busy={busy}>
            {busy ? 'Cancelling…' : 'CANCEL EVENT'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
