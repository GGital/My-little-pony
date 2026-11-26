import React, { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { ApiErrorDetail, Game, StoreContact } from '../../api/types'
import { ErrorState } from '../../components/ErrorState'
import { FormFieldError, fieldErrorProps } from '../../components/FormFieldError'
import { Loading } from '../../components/Loading'
import { Notice } from '../../components/Notice'
import { PageTop } from '../../components/PageTop'
import { SubmitButton } from '../../components/SubmitButton'
import { GAME_LABELS, GAME_VALUES } from '../../utils/games'
import './StoreProfile.css'

type Store = { displayName: string; games: Game[]; contact: StoreContact }
type ContactForm = { contactPhone: string; contactEmail: string; contactWebsite: string; contactLine: string }

const FIELDS: { id: keyof ContactForm; label: string; hint: string; type?: string; placeholder: string }[] = [
  { id: 'contactPhone', label: 'Phone', hint: 'for example 02 555 0101', type: 'tel', placeholder: '02 555 0101' },
  { id: 'contactEmail', label: 'Email', hint: 'shown to players, not your sign-in', type: 'email', placeholder: 'hello@store.example' },
  { id: 'contactWebsite', label: 'Website', hint: 'starts with https://', type: 'text', placeholder: 'https://store.example' },
  { id: 'contactLine', label: 'LINE ID', hint: 'for example @quantumcards', type: 'text', placeholder: '@quantumcards' },
]

/**
 * `/organizer/store` (Feature-U, UX-17, UX-19): the store's games as toggle chips and its public contact details,
 * read and saved with E-23. The contact shows on every event the store hosts (D-37).
 */
export const StoreProfile: React.FC = () => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [name, setName] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [contact, setContact] = useState<ContactForm>({ contactPhone: '', contactEmail: '', contactWebsite: '', contactLine: '' })
  const [details, setDetails] = useState<ApiErrorDetail[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const fill = (s: Store) => {
    setName(s.displayName)
    setGames(s.games)
    setContact({
      contactPhone: s.contact?.phone ?? '',
      contactEmail: s.contact?.email ?? '',
      contactWebsite: s.contact?.website ?? '',
      contactLine: s.contact?.line ?? '',
    })
  }

  useEffect(() => {
    let current = true
    api
      .get<Store>('/api/organizer/store')
      .then((s) => {
        if (!current) return
        fill(s)
        setState('ready')
      })
      .catch(() => current && setState('error'))
    return () => {
      current = false
    }
  }, [])

  // After a refused save, focus goes to the first invalid field (games first, then the contact fields in order).
  useEffect(() => {
    if (details.length === 0) return
    const first = details.some((d) => d.field === 'games')
      ? document.querySelector<HTMLElement>('.store-profile__chip')
      : FIELDS.map((f) => document.getElementById(f.id)).find((el, i) => el && details.some((d) => d.field === FIELDS[i].id))
    first?.focus()
  }, [details])

  const toggle = (g: Game) => {
    setSaved(false)
    setGames((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setSaved(false)
    setProblem(null)
    setDetails([])
    try {
      fill(await api.patch<Store>('/api/organizer/store', { games, ...contact }))
      setSaved(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setDetails(err.details ?? [])
        setProblem(err.details?.length ? null : err.message)
      } else {
        setProblem('Could not save the profile. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <Loading />
  if (state === 'error') return <ErrorState message="Could not load your store profile." />

  return (
    <>
      <PageTop title="Store profile" subtitle={`${name}: the games you play and how players reach you. Both show on every event you host.`} />
      <div className="pbody">
        <form onSubmit={save} noValidate className="form-section store-profile" style={{ maxWidth: 760 }}>
          {problem && <Notice tone="error">{problem}</Notice>}
          {saved && <div role="status" className="store-profile__saved">Profile saved.</div>}

          <section className="form-card">
            <h2>Games played here</h2>
            <div className="store-profile__chips">
              {GAME_VALUES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={games.includes(g) ? 'chip chip--game store-profile__chip is-on' : 'chip store-profile__chip'}
                  aria-pressed={games.includes(g)}
                  onClick={() => toggle(g)}
                  disabled={busy}
                >
                  {GAME_LABELS[g]}
                </button>
              ))}
            </div>
            <FormFieldError field="games" details={details} />
          </section>

          <section className="form-card">
            <h2>Contact details</h2>
            <p className="sub small">Public. Leave a field empty to remove it.</p>
            {FIELDS.map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="form-label">
                  {f.label} <span className="field-hint">({f.hint})</span>
                </label>
                <input
                  id={f.id}
                  name={f.id}
                  type={f.type}
                  className="form-control"
                  placeholder={f.placeholder}
                  value={contact[f.id]}
                  onChange={(e) => {
                    setSaved(false)
                    setContact((c) => ({ ...c, [f.id]: e.target.value }))
                  }}
                  disabled={busy}
                  {...fieldErrorProps(f.id, details)}
                />
                <FormFieldError field={f.id} details={details} />
              </div>
            ))}
          </section>

          <div className="form-actions">
            <SubmitButton busy={busy} busyLabel="Saving…" disabled={busy} className="btn-big">
              Save profile
            </SubmitButton>
          </div>
        </form>
      </div>
    </>
  )
}
