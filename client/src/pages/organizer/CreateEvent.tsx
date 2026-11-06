import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { ApiErrorDetail, EventDetail } from '../../api/types'
import { FormFieldError } from '../../components/FormFieldError'
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

  return (
    <div className="container py-4" style={{ maxWidth: '720px' }}>
      <h1 className="fw-bold mb-4">Create & Publish Event</h1>

      {generalError && (!details || details.length === 0) && (
        <div className="alert alert-danger" role="alert">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* 1. Title */}
        <div className="mb-3">
          <label htmlFor="title" className="form-label fw-bold">
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            className="form-control"
            placeholder="e.g. Friday Night Constructed"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="title" details={details} />
        </div>

        {/* 2. Type & Format (Radio Cards) */}
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label fw-bold d-block">
              Event Type <span className="text-danger">*</span>
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {(['CASUAL', 'TOURNAMENT', 'RELEASE'] as const).map((t) => (
                <label
                  key={t}
                  className={`btn btn-sm ${type === t ? 'btn-primary' : 'btn-outline-secondary'}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="visually-hidden"
                    disabled={submitting}
                  />
                  {t}
                </label>
              ))}
            </div>
            <FormFieldError field="type" details={details} />
          </div>

          <div className="col-md-6">
            <label className="form-label fw-bold d-block">
              Format <span className="text-danger">*</span>
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {(['CONSTRUCTED', 'SEALED', 'DRAFT'] as const).map((f) => (
                <label
                  key={f}
                  className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-outline-secondary'}`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="visually-hidden"
                    disabled={submitting}
                  />
                  {f}
                </label>
              ))}
            </div>
            <FormFieldError field="format" details={details} />
          </div>
        </div>

        {/* 3. Venue Name, Address, City */}
        <div className="mb-3">
          <label htmlFor="venueName" className="form-label fw-bold">
            Venue Name <span className="text-danger">*</span>
          </label>
          <input
            id="venueName"
            name="venueName"
            type="text"
            className="form-control"
            placeholder="e.g. Quantum Cards"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="venueName" details={details} />
        </div>

        <div className="mb-3">
          <label htmlFor="venueAddress" className="form-label fw-bold">
            Venue Address <span className="text-danger">*</span>
          </label>
          <input
            id="venueAddress"
            name="venueAddress"
            type="text"
            className="form-control"
            placeholder="e.g. 1631 Kanchanaphisek Rd"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="venueAddress" details={details} />
        </div>

        <div className="mb-3">
          <label htmlFor="city" className="form-label fw-bold">
            City <span className="text-danger">*</span>
          </label>
          <input
            id="city"
            name="city"
            type="text"
            className="form-control"
            placeholder="e.g. Bangkok"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="city" details={details} />
        </div>

        {/* 4. Start & End Date-Time (Bangkok time) */}
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label htmlFor="startAt" className="form-label fw-bold">
              Start Date & Time (Bangkok) <span className="text-danger">*</span>
            </label>
            <input
              id="startAt"
              name="startAt"
              type="datetime-local"
              className="form-control"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              disabled={submitting}
            />
            <FormFieldError field="startAt" details={details} />
          </div>

          <div className="col-md-6">
            <label htmlFor="endAt" className="form-label fw-bold">
              End Date & Time (Bangkok) <span className="text-danger">*</span>
            </label>
            <input
              id="endAt"
              name="endAt"
              type="datetime-local"
              className="form-control"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              disabled={submitting}
            />
            <FormFieldError field="endAt" details={details} />
          </div>
        </div>

        {/* 5. Capacity */}
        <div className="mb-3">
          <label htmlFor="capacity" className="form-label fw-bold">
            Capacity (1–256) <span className="text-danger">*</span>
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min="1"
            max="256"
            className="form-control"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="capacity" details={details} />
        </div>

        {/* 6. Fee Label */}
        <div className="mb-3">
          <label htmlFor="feeLabel" className="form-label fw-bold">
            Fee Label <span className="text-muted fw-normal">(optional, max 40 chars)</span>
          </label>
          <input
            id="feeLabel"
            name="feeLabel"
            type="text"
            maxLength={40}
            className="form-control"
            placeholder="e.g. Free or THB 250"
            value={feeLabel}
            onChange={(e) => setFeeLabel(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="feeLabel" details={details} />
        </div>

        {/* 7. Structure Note */}
        <div className="mb-3">
          <label htmlFor="structureNote" className="form-label fw-bold">
            Structure Note <span className="text-muted fw-normal">(optional, max 80 chars)</span>
          </label>
          <input
            id="structureNote"
            name="structureNote"
            type="text"
            maxLength={80}
            className="form-control"
            placeholder="e.g. 4 rounds · Best of 1"
            value={structureNote}
            onChange={(e) => setStructureNote(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="structureNote" details={details} />
        </div>

        {/* 8. Contact */}
        <div className="mb-3">
          <label htmlFor="contact" className="form-label fw-bold">
            Contact <span className="text-muted fw-normal">(optional, max 120 chars)</span>
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            maxLength={120}
            className="form-control"
            placeholder="e.g. hello@quantumcards.example"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="contact" details={details} />
        </div>

        {/* 9. Description with Character Counter */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-baseline mb-1">
            <label htmlFor="description" className="form-label fw-bold mb-0">
              Description <span className="text-muted fw-normal">(optional, max 2,000 chars)</span>
            </label>
            <span className="small text-muted">{description.length} / 2,000</span>
          </div>
          <textarea
            id="description"
            name="description"
            rows={5}
            maxLength={2000}
            className="form-control"
            placeholder="Details about deck rules, prizes, schedule..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
          <FormFieldError field="description" details={details} />
        </div>

        {/* Submit */}
        <div className="d-flex gap-3">
          <SubmitButton
            busy={submitting}
            busyLabel="Publishing…"
            className="btn-primary px-4 py-2"
          >
            PUBLISH EVENT
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}
