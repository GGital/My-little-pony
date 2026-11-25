import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { ApiErrorDetail, EventChange, EventDetail } from '../../api/types'
import { EventFields, toBangkokIso, toBangkokLocal, type EventFormValues } from '../../components/EventFields'
import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { Notice } from '../../components/Notice'
import { PageTop } from '../../components/PageTop'
import { NotFoundPage } from '../../routes/pages/NotFoundPage'

/** BR-15, D-19: after the start only these may change; the rest is shown read-only (UX-08). */
const SAFE_AFTER_START = new Set<keyof EventFormValues>(['description', 'structureNote', 'contact', 'feeLabel'])
const ALL_FIELDS: (keyof EventFormValues)[] = [
  'title', 'type', 'format', 'venueName', 'venueAddress', 'city', 'startAt', 'endAt',
  'capacity', 'feeLabel', 'structureNote', 'contact', 'description',
]
const OPTIONAL = new Set<keyof EventFormValues>(['feeLabel', 'structureNote', 'contact', 'description'])

const toForm = (e: EventDetail): EventFormValues => ({
  title: e.title, type: e.type as EventFormValues['type'], format: e.format as EventFormValues['format'], venueName: e.venueName, venueAddress: e.venueAddress, city: e.city,
  startAt: toBangkokLocal(e.startAt), endAt: toBangkokLocal(e.endAt), capacity: String(e.capacity),
  feeLabel: e.feeLabel ?? '', structureNote: e.structureNote ?? '', contact: e.contact ?? '', description: e.description ?? '',
})

/** Only the fields that differ from the saved event, in the API's shape (UX-06). */
function changedBody(values: EventFormValues, saved: EventFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const key of ALL_FIELDS) {
    if (values[key] === saved[key]) continue
    if (key === 'startAt' || key === 'endAt') body[key] = toBangkokIso(values[key])
    else if (key === 'capacity') body[key] = values.capacity === '' ? null : Number(values.capacity)
    else if (OPTIONAL.has(key)) body[key] = values[key] || null
    else body[key] = values[key]
  }
  return body
}

// ---- History panel (SR-08, UX-14): "23 Nov · 15:00 — Quantum Cards changed capacity from 24 to 30" ----
const FIELD_NAMES: Record<string, string> = {
  title: 'title', type: 'type', format: 'format', venueName: 'venue name', venueAddress: 'venue address', city: 'city',
  startAt: 'start', endAt: 'end', feeLabel: 'fee', structureNote: 'structure note', contact: 'contact', description: 'description',
}
const bangkok = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', ...opts }).format(new Date(iso))

function describe(c: EventChange): string {
  if (c.field === 'capacity') return `changed capacity from ${c.oldValue} to ${c.newValue}`
  if (c.field === 'deadline') return 'changed the registration deadline'
  if (c.field === 'details') return `changed ${c.newValue.split(', ').map((f) => FIELD_NAMES[f] ?? f).join(', ')}`
  if (c.newValue === 'CANCELLED') return 'cancelled the event'
  if (c.oldValue === 'DRAFT') return 'published the draft'
  return c.newValue === 'DRAFT' ? 'saved the draft' : 'published the event'
}
const historyLine = (c: EventChange) =>
  `${bangkok(c.changedAt, { day: 'numeric', month: 'short' })} · ${bangkok(c.changedAt, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} — ${c.changedBy.displayName} ${describe(c)}`

/** The server's message and each field detail, for a refusal shown above the form. */
const reason = (err: ApiError) => [err.message, ...(err.details ?? []).map((d) => d.message)].join(' ')

/**
 * `/organizer/events/:id/edit` (Feature-L, Sprint 2 contracts §3): the create form filled with the event, sending only
 * what changed with E-13; the History panel (E-17); Registrations and the event page; PUBLISH EVENT for a draft.
 */
export const EditEvent: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [saved, setSaved] = useState<EventFormValues | null>(null)
  const [values, setValues] = useState<EventFormValues | null>(null)
  const [history, setHistory] = useState<EventChange[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [busy, setBusy] = useState<false | 'save' | 'publish'>(false)
  const [details, setDetails] = useState<ApiErrorDetail[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(() => (location.state as { toast?: string } | null)?.toast ?? null)

  useEffect(() => {
    if ((location.state as { toast?: string } | null)?.toast) navigate(location.pathname, { replace: true, state: null })
  }, [navigate, location.pathname, location.state])

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await api.get<{ items: EventChange[] }>(`/api/organizer/events/${id}/changes`)).items)
    } catch {
      setHistory([])
    }
  }, [id])

  const load = useCallback(async () => {
    if (!id || !/^[1-9]\d*$/.test(id)) return setState('missing')
    setState('loading')
    try {
      const data = await api.get<EventDetail>(`/api/events/${id}`)
      if (data.viewer.action !== 'MANAGE') return setState('missing')
      setEvent(data)
      setSaved(toForm(data))
      setValues(toForm(data))
      setState('ready')
      await loadHistory()
    } catch (err) {
      setState(err instanceof ApiError && (err.status === 404 || err.status === 400) ? 'missing' : 'error')
    }
  }, [id, loadHistory])

  useEffect(() => {
    load()
  }, [load])

  const body = useMemo(() => (values && saved ? changedBody(values, saved) : {}), [values, saved])
  const dirty = Object.keys(body).length > 0

  // UX-09: "Leave without saving?" before following any link, or closing the tab, with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('a[href]')) return
      if (!window.confirm('Leave without saving?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [dirty])

  const onChange = <K extends keyof EventFormValues>(name: K, value: EventFormValues[K]) =>
    setValues((v) => (v ? { ...v, [name]: value } : v))

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dirty || busy) return
    setBusy('save')
    setDetails([])
    setProblem(null)
    setToast(null)
    try {
      const updated = await api.patch<EventDetail>(`/api/organizer/events/${id}`, body)
      setEvent(updated)
      setSaved(toForm(updated))
      setValues(toForm(updated))
      setToast('Changes saved.')
      await loadHistory()
    } catch (err) {
      if (err instanceof ApiError && err.status !== 409 && err.details?.length) setDetails(err.details)
      else setProblem(err instanceof ApiError ? reason(err) : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const onPublish = async () => {
    if (!event || busy) return
    setBusy('publish')
    setProblem(null)
    try {
      setEvent(await api.post<EventDetail>(`/api/organizer/events/${event.id}/publish`))
      setToast('Your event is live.')
      await loadHistory()
    } catch (err) {
      setProblem(err instanceof ApiError ? reason(err) : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <Loading label="Loading event…" />
  if (state === 'missing') return <NotFoundPage />
  if (state === 'error' || !event || !values) return <ErrorState message="Failed to load the event." onRetry={load} />

  const started = event.hasStarted
  const readOnly = started ? new Set(ALL_FIELDS.filter((f) => !SAFE_AFTER_START.has(f))) : undefined
  const isDraft = event.status === 'DRAFT'

  return (
    <>
      <PageTop title="Edit event" subtitle={event.title} />
      <div className="pbody">
        <div className="page-alerts">
          {isDraft && <Notice tone="warning" role="status">Draft — only you can see this event.</Notice>}
          {toast && <Notice tone="success" onClose={() => setToast(null)}>{toast}</Notice>}
          {started && (
            <Notice tone="info">This event has started. Only the description, structure, contact and fee can change.</Notice>
          )}
          {problem && <Notice tone="error">{problem}</Notice>}
        </div>

        <div className="cols">
          <form onSubmit={onSave} noValidate className="form-section cols__main">
            <EventFields
              values={values}
              onChange={onChange}
              details={details}
              disabled={busy !== false}
              readOnly={readOnly}
              startHint={started ? undefined : 'at least 1 hour from now'}
              capacityNote={`At least ${event.registeredCount}: that's how many players are registered.`}
            />
            <div className="form-actions">
              <button type="submit" className="btn-big" disabled={!dirty || busy !== false} aria-busy={busy === 'save'}>
                {busy === 'save' ? 'Saving…' : 'SAVE CHANGES'}
              </button>
              {isDraft && (
                <button type="button" className="btn-big btn-big--outline" onClick={onPublish} disabled={busy !== false} aria-busy={busy === 'publish'}>
                  {busy === 'publish' ? 'Publishing…' : 'PUBLISH EVENT'}
                </button>
              )}
            </div>
          </form>

          <div className="cols__side">
            <section className="box manage-box">
              <h2>Your event</h2>
              <p className="d-flex gap-2 flex-wrap">
                <Link to={`/organizer/events/${event.id}/registrations`} className="btn-soft">
                  Registrations
                </Link>
                <Link to={`/events/${event.id}`} className="btn-soft">
                  View event page
                </Link>
              </p>
            </section>
            <section className="box history-box" aria-label="History">
              <h2>History</h2>
              {history.length === 0 ? (
                <p className="sub">No changes yet.</p>
              ) : (
                <ul className="history-list">
                  {history.map((c) => (
                    <li key={c.id}>{historyLine(c)}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
