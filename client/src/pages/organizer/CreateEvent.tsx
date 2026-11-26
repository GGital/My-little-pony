import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { ApiErrorDetail, EventDetail } from '../../api/types'
import { EMPTY_EVENT_FORM, EventFields, toBangkokIso, type EventFormValues } from '../../components/EventFields'
import { Notice } from '../../components/Notice'
import { PageTop } from '../../components/PageTop'
import { SubmitButton } from '../../components/SubmitButton'

/** `/organizer/events/new` (Feature-D; SAVE DRAFT from Feature-K). The fields are shared with the edit page. */
export const CreateEvent: React.FC = () => {
  const navigate = useNavigate()
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_FORM)
  const [details, setDetails] = useState<ApiErrorDetail[]>([])
  const [generalError, setGeneralError] = useState<string | null>(null)
  // Which button is working: PUBLISH EVENT or SAVE DRAFT (Sprint 2 Feature-K). Both are disabled while either is.
  const [submitting, setSubmitting] = useState<false | 'publish' | 'draft'>(false)

  const onChange = <K extends keyof EventFormValues>(name: K, value: EventFormValues[K]) =>
    setValues((v) => ({ ...v, [name]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void send(false)
  }

  /** E-06; `asDraft` adds saveAsDraft (D-18) and lands on the draft's edit page (contracts §2 v0.8). */
  const send = async (asDraft: boolean) => {
    if (submitting) return
    setDetails([])
    setGeneralError(null)
    setSubmitting(asDraft ? 'draft' : 'publish')

    const payload = {
      title: values.title,
      type: values.type,
      format: values.format,
      venueName: values.venueName,
      venueAddress: values.venueAddress,
      city: values.city,
      startAt: toBangkokIso(values.startAt),
      endAt: toBangkokIso(values.endAt),
      ...(values.registrationDeadline ? { registrationDeadline: toBangkokIso(values.registrationDeadline) } : {}),
      capacity: values.capacity === '' ? (null as unknown as number) : Number(values.capacity),
      feeLabel: values.feeLabel || null,
      structureNote: values.structureNote || null,
      contact: values.contact || null,
      description: values.description || null,
      ...(asDraft ? { saveAsDraft: true } : {}),
    }

    try {
      const res = await api.post<EventDetail>('/api/events', payload)
      if (asDraft) navigate(`/organizer/events/${res.id}/edit`, { state: { toast: 'Draft saved. Only you can see it.' } })
      else navigate(`/events/${res.id}`, { state: { toast: 'Your event is live.' } })
    } catch (err) {
      if (err instanceof ApiError) {
        setDetails(err.details ?? [])
        setGeneralError(err.message)
      } else {
        setGeneralError(asDraft ? 'Failed to save the draft. Please try again.' : 'Failed to publish event. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageTop title="Create an event" subtitle="It goes live as soon as you publish it, or save a draft that only you can see. Times are Bangkok time." />
      <div className="pbody">
        <form onSubmit={handleSubmit} noValidate className="form-section" style={{ maxWidth: 760 }}>
          {generalError && (!details || details.length === 0) && <Notice tone="error">{generalError}</Notice>}

          <EventFields values={values} onChange={onChange} details={details} disabled={submitting !== false} startHint="at least 1 hour from now" />

          <div className="form-actions">
            <SubmitButton busy={submitting === 'publish'} busyLabel="Publishing…" disabled={submitting !== false} className="btn-big">
              PUBLISH EVENT
            </SubmitButton>
            <button
              type="button"
              className="btn-big btn-big--outline"
              onClick={() => void send(true)}
              disabled={submitting !== false}
              aria-busy={submitting === 'draft'}
            >
              {submitting === 'draft' ? 'Saving…' : 'SAVE DRAFT'}
            </button>
            <span className="sub small">Fields marked * are required.</span>
          </div>
        </form>
      </div>
    </>
  )
}
