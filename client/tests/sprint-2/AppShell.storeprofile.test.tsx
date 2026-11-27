import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../src/components/AppShell'
import { AuthProvider } from '../../src/auth/AuthContext'
import type { AuthUser } from '../../src/api/types'

// TEST-U-07 (C) · FR-30, UX-17, D-41 review of #113 (Sprint 2 contracts §11.1 behaviour 6): "Store profile" is in the
// organizer's account menu, next to Dashboard and Sign out. Players do not get it.
const open = (user: AuthUser) => {
  render(
    <AuthProvider initialStatus="signedIn" initialUser={user}>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </AuthProvider>,
  )
  fireEvent.click(screen.getByTestId('user-menu-btn'))
}

describe('TEST-U-07 (C) Store profile in the account menu', () => {
  it('an organizer sees a Store profile item that goes to /organizer/store', () => {
    open({ id: 1, displayName: 'Quantum Cards', email: 'o@x.example', role: 'ORGANIZER' })
    expect(screen.getByRole('link', { name: 'Store profile' })).toHaveAttribute('href', '/organizer/store')
  })

  it('a participant does not', () => {
    open({ id: 7, displayName: 'Mint', email: 'm@x.example', role: 'PARTICIPANT' })
    expect(screen.queryByRole('link', { name: 'Store profile' })).not.toBeInTheDocument()
  })
})
