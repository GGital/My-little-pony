import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ActionButton } from '../../src/components/ActionButton'

function renderButton(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('TEST-F-02 (C) — ActionButton states (AC-F-02, FR-12)', () => {
  it('renders SIGN IN TO REGISTER as enabled link/button pointing to login with returnTo', () => {
    renderButton(<ActionButton action="SIGN_IN_TO_REGISTER" eventId={1} />)
    const btn = screen.getByRole('link', { name: /SIGN IN TO REGISTER/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('href', '/login?returnTo=%2Fevents%2F1')
  })

  it('renders REGISTER as an enabled primary button', () => {
    renderButton(<ActionButton action="REGISTER" eventId={1} />)
    const btn = screen.getByRole('button', { name: /^REGISTER$/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeEnabled()
  })

  it('renders REGISTERED as disabled with a link to My Events', () => {
    renderButton(<ActionButton action="REGISTERED" eventId={1} registrationId={42} />)
    const btn = screen.getByRole('button', { name: 'REGISTERED' })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeDisabled()

    const link = screen.getByRole('link', { name: /See it in My Events/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/me/registrations')
  })

  it('renders ORGANIZER_CANNOT_REGISTER without a button and shows the note', () => {
    renderButton(<ActionButton action="ORGANIZER_CANNOT_REGISTER" eventId={1} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/Organizer accounts can't register for events/i)).toBeInTheDocument()
  })

  it('renders MANAGE as MANAGE EVENT linking to event registrations', () => {
    renderButton(<ActionButton action="MANAGE" eventId={1} />)
    const btn = screen.getByRole('link', { name: /MANAGE EVENT/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('href', '/organizer/events/1/registrations')
  })

  it('renders FULL as a disabled button', () => {
    renderButton(<ActionButton action="FULL" eventId={1} capacity={2} />)
    const btn = screen.getByRole('button', { name: /^FULL$/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeDisabled()
  })

  it('renders CLOSED as a disabled REGISTRATION CLOSED button', () => {
    renderButton(<ActionButton action="CLOSED" eventId={1} />)
    const btn = screen.getByRole('button', { name: /REGISTRATION CLOSED/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeDisabled()
  })
})
