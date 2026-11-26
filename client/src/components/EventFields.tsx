import React from 'react'
import type { ApiErrorDetail } from '../api/types'
import { label } from '../utils/eventDisplay'
import { FormFieldError, fieldErrorProps } from './FormFieldError'

/** Every field of the create and edit forms, as the inputs hold them (times are Bangkok `datetime-local`). */
export type EventFormValues = {
  title: string
  type: 'CASUAL' | 'TOURNAMENT' | 'RELEASE'
  format: 'CONSTRUCTED' | 'SEALED' | 'DRAFT'
  venueName: string
  venueAddress: string
  city: string
  startAt: string
  endAt: string
  /** Feature-M: empty = registration closes at the start. */
  registrationDeadline: string
  capacity: string
  feeLabel: string
  structureNote: string
  contact: string
  description: string
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '', type: 'CASUAL', format: 'CONSTRUCTED', venueName: '', venueAddress: '', city: '',
  startAt: '', endAt: '', registrationDeadline: '', capacity: '24', feeLabel: '', structureNote: '', contact: '', description: '',
}

/** `YYYY-MM-DDTHH:mm` (Bangkok wall time, the form's input) → ISO with +07:00, as the API expects (NFR-11). */
export function toBangkokIso(local: string): string {
  if (!local) return ''
  if (local.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(local)) return local
  if (local.length === 16) return `${local}:00.000+07:00`
  if (local.length === 19) return `${local}.000+07:00`
  return local
}

/** An ISO instant → `YYYY-MM-DDTHH:mm` in Bangkok, for a `datetime-local` input. */
export function toBangkokLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

type Props = {
  values: EventFormValues
  onChange: <K extends keyof EventFormValues>(name: K, value: EventFormValues[K]) => void
  details: ApiErrorDetail[]
  disabled: boolean
  /** Fields shown read-only (a started event, contracts §3 UX-08). */
  readOnly?: ReadonlySet<keyof EventFormValues>
  startHint?: string
  /** A line under the capacity field (the edit page's "At least {n} …", UX-07). */
  capacityNote?: string
}

/**
 * The fields of Create an event (Feature-D) and Edit event (Feature-L, UX-06), in the same order, with the server's
 * field errors under each one. The parent owns the values and sends them.
 */
export const EventFields: React.FC<Props> = ({ values, onChange, details, disabled, readOnly, startHint, capacityNote }) => {
  type TextKey = Exclude<keyof EventFormValues, 'type' | 'format' | 'description'>
  const field = (o: { id: TextKey; label: string; required?: boolean; hint?: string; type?: string; placeholder?: string; maxLength?: number }) => {
    const { id, label: text, required, hint, type = 'text', placeholder, maxLength } = o
    return (
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
          onChange={(e) => onChange(id, e.target.value)}
          disabled={disabled}
          readOnly={readOnly?.has(id) || undefined}
          aria-required={required || undefined}
          {...fieldErrorProps(id, details)}
        />
        {id === 'capacity' && capacityNote && <p className="sub small capacity-hint">{capacityNote}</p>}
        <FormFieldError field={id} details={details} />
      </div>
    )
  }

  const choices = <K extends 'type' | 'format'>(name: K, legend: string, options: readonly EventFormValues[K][]) => (
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
              checked={values[name] === o}
              onChange={() => onChange(name, o)}
              className="visually-hidden"
              disabled={disabled || readOnly?.has(name)}
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
      <section className="form-card">
        <h2>The event</h2>
        {field({ id: 'title', label: 'Title', required: true, placeholder: 'e.g. Friday Night Constructed' })}
        <div className="form-grid">
          {choices('type', 'Event Type', ['CASUAL', 'TOURNAMENT', 'RELEASE'] as const)}
          {choices('format', 'Format', ['CONSTRUCTED', 'SEALED', 'DRAFT'] as const)}
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
          {field({ id: 'startAt', label: 'Start Date & Time (Bangkok)', required: true, hint: startHint, type: 'datetime-local' })}
          {field({ id: 'endAt', label: 'End Date & Time (Bangkok)', required: true, type: 'datetime-local' })}
        </div>
        {field({ id: 'registrationDeadline', label: 'Registration closes (Bangkok)', hint: 'Leave empty to close at the start time.', type: 'datetime-local' })}
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
            <span className="small sub tabular-nums">{values.description.length} / 2,000</span>
          </div>
          <textarea
            id="description"
            name="description"
            rows={5}
            maxLength={2000}
            className="form-control"
            placeholder="Deck rules, prizes, schedule…"
            value={values.description}
            onChange={(e) => onChange('description', e.target.value)}
            disabled={disabled}
            {...fieldErrorProps('description', details)}
          />
          <FormFieldError field="description" details={details} />
        </div>
      </section>
    </>
  )
}
