import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { ApiErrorDetail, EventDetail } from '../../api/types'
import { FormFieldError, fieldErrorProps } from '../../components/FormFieldError'
import { Notice } from '../../components/Notice'
import { PageTop } from '../../components/PageTop'
import { label } from '../../utils/eventDisplay'
import { SubmitButton } from '../../components/SubmitButton'

export const CreateEvent: React.FC = () => {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [type, setType] = useState<'CASUAL' | 'TOURNAMENT' | 'RELEASE'>('CASUAL')
  const [format, setFormat] = useState<'CONSTRUCTED' | 'SEALED' | 'DRAFT'>('CONSTRUCTED')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [city, setCity] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [capacity, setCapacity] = useState<string>('24')
  const [feeLabel, setFeeLabel] = useState('')
  const [structureNote, setStructureNote] = useState('')
  const [contact, setContact] = useState('')
  const [description, setDescription] = useState('')

  const [details, setDetails] = useState<ApiErrorDetail[]>([])
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const formatBangkokIso = (localStr: string) => {
    if (!localStr) return ''
    // If already has timezone or offset, keep it
    if (localStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(localStr)) return localStr
    // If datetime-local 'YYYY-MM-DDTHH:mm'
    if (localStr.length === 16) return `${localStr}:00.000+07:00`
    if (localStr.length === 19) return `${localStr}.000+07:00`
    return localStr
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDetails([])
    setGeneralError(null)
    setSubmitting(true)

    const payload = {
      title,
      type,
      format,
      venueName,
      venueAddress,
      city,
      startAt: formatBangkokIso(startAt),
      endAt: formatBangkokIso(endAt),
      capacity: capacity === '' ? (null as unknown as number) : Number(capacity),
      feeLabel: feeLabel || null,
      structureNote: structureNote || null,
      contact: contact || null,
      description: description || null,
    }

    try {
      const res = await api.post<EventDetail>('/api/events', payload)
      navigate(`/events/${res.id}`, { state: { toast: 'Your event is live.' } })
    } catch (err) {
      if (err instanceof ApiError) {
        setDetails(err.details ?? [])
        setGeneralError(err.message)
      } else {
        setGeneralError('Failed to publish event. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  type TextField = {
    id: keyof typeof values
    label: string
    required?: boolean
    hint?: string
    type?: string
    placeholder?: string
    maxLength?: number
  }
  const values = { title, venueName, venueAddress, city, startAt, endAt, capacity, feeLabel, structureNote, contact }
  const setters: Record<keyof typeof values, (v: string) => void> = {
    title: setTitle,
    venueName: setVenueName,
    venueAddress: setVenueAddress,
    city: setCity,
    startAt: setStartAt,
    endAt: setEndAt,
    capacity: setCapacity,
    feeLabel: setFeeLabel,
    structureNote: setStructureNote,
    contact: setContact,
  }

  const field = ({ id, label: text, required, hint, type = 'text', placeholder, maxLength }: TextField) => (
    <div>
      <label htmlFor={id} className="form-label">
        {text} {required && <span className="req" aria-hidden="true">*</span>}
        {hint && <span className="field-hint">({hint})</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        className="form-control"
        placeholder={placeholder}
        maxLength={maxLength}
        min={type === 'number' ? 1 : undefined}
        max={type === 'number' ? 256 : undefined}
        value={values[id]}
        onChange={(e) => setters[id](e.target.value)}
        disabled={submitting}
        aria-required={required || undefined}
        {...fieldErrorProps(id, details)}
      />
      <FormFieldError field={id} details={details} />
    </div>
  )

  const choices = <T extends string>(name: string, legend: string, options: readonly T[], value: T, set: (v: T) => void) => (
    <fieldset>
      <legend className="form-label">
        {legend} <span className="req" aria-hidden="true">*</span>
      </legend>
      <div className="choice-group">
        {options.map((o) => (
          <label key={o} className="choice" title={label(o)}>
            <input
              type="radio"
              name={name}
              value={o}
              checked={value === o}
              onChange={() => set(o)}
              className="visually-hidden"
              disabled={submitting}
            />
            {o}
          </label>
        ))}
      </div>
      <FormFieldError field={name} details={details} />
    </fieldset>
  )

  return (
    <>
      <PageTop title="Create an event" subtitle="It goes live as soon as you publish it. Times are Bangkok time." />
      <div className="pbody">
        <form onSubmit={handleSubmit} noValidate className="form-section" style={{ maxWidth: 760 }}>
          {generalError && (!details || details.length === 0) && <Notice tone="error">{generalError}</Notice>}

          <section className="form-card">
            <h2>The event</h2>
            {field({ id: 'title', label: 'Title', required: true, placeholder: 'e.g. Friday Night Constructed' })}
            <div className="form-grid">
              {choices('type', 'Event Type', ['CASUAL', 'TOURNAMENT', 'RELEASE'] as const, type, setType)}
              {choices('format', 'Format', ['CONSTRUCTED', 'SEALED', 'DRAFT'] as const, format, setFormat)}
            </div>
          </section>

          <section className="form-card">
            <h2>Where</h2>
            {field({ id: 'venueName', label: 'Venue Name', required: true, placeholder: 'e.g. Quantum Cards' })}
            {field({ id: 'venueAddress', label: 'Venue Address', required: true, placeholder: 'e.g. 1631 Kanchanaphisek Rd' })}
            {field({ id: 'city', label: 'City', required: true, placeholder: 'e.g. Bangkok' })}
          </section>

          <section className="form-card">
            <h2>When</h2>
            <div className="form-grid">
              {field({ id: 'startAt', label: 'Start Date & Time (Bangkok)', required: true, type: 'datetime-local' })}
              {field({ id: 'endAt', label: 'End Date & Time (Bangkok)', required: true, type: 'datetime-local' })}
            </div>
            <p className="sub small">An event can last at most 24 hours.</p>
          </section>

          <section className="form-card">
            <h2>Seats and fee</h2>
            <div className="form-grid">
              {field({ id: 'capacity', label: 'Capacity', required: true, hint: '1–256', type: 'number' })}
              {field({ id: 'feeLabel', label: 'Fee Label', hint: 'optional, max 40', placeholder: 'e.g. Free or THB 250', maxLength: 40 })}
            </div>
          </section>

          <section className="form-card">
            <h2>More details</h2>
            {field({ id: 'structureNote', label: 'Structure Note', hint: 'optional, max 80', placeholder: 'e.g. 4 rounds · Best of 1', maxLength: 80 })}
            {field({ id: 'contact', label: 'Contact', hint: 'optional, max 120', placeholder: 'e.g. hello@quantumcards.example', maxLength: 120 })}
            <div>
              <div className="d-flex justify-content-between align-items-baseline">
                <label htmlFor="description" className="form-label">
                  Description <span className="field-hint">(optional)</span>
                </label>
                <span className="small sub tabular-nums">{description.length} / 2,000</span>
              </div>
              <textarea
                id="description"
                name="description"
                rows={5}
                maxLength={2000}
                className="form-control"
                placeholder="Deck rules, prizes, schedule…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                {...fieldErrorProps('description', details)}
              />
              <FormFieldError field="description" details={details} />
            </div>
          </section>

          <div className="form-actions">
            <SubmitButton busy={submitting} busyLabel="Publishing…" className="btn-big">
              PUBLISH EVENT
            </SubmitButton>
            <span className="sub small">Fields marked * are required.</span>
          </div>
        </form>
      </div>
    </>
  )
}
