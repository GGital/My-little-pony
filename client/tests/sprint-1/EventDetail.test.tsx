import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { EventDetail } from '../../src/pages/EventDetail'
import type { EventDetail as EventDetailType } from '../../src/api/types'

const MOCK_EVENT: EventDetailType = {
  id: 1,
  title: 'Friday Night Constructed',
  type: 'CASUAL',
  format: 'CONSTRUCTED',
  venueName: 'Quantum Cards',
  venueAddress: '1631 Kanchanaphisek Rd, Bang Khae, Bangkok 10160',
  city: 'Bangkok',
  startAt: '2026-11-06T10:00:00.000Z',
  endAt: '2026-11-06T14:00:00.000Z',
  capacity: 24,
  registeredCount: 3,
  seatsRemaining: 21,
  status: 'PUBLISHED',
  feeLabel: 'THB 250',
  structureNote: '4 rounds · Best of 1',
  contact: 'hello@quantumcards.example',
  description: '<script>alert(1)</script><b>bold</b>',
  organizer: { displayName: 'Quantum Cards' },
  hasStarted: false,
  viewer: { action: 'REGISTER', registrationId: null },
}

describe('TEST-C-06 (C) — XSS prevention and safe text rendering (AC-C-06, NFR-15)', () => {
  it('renders dangerous description text literally, executes no script, and creates no <b> DOM element', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_EVENT,
    } as Response)

    const { container } = render(
      <MemoryRouter initialEntries={['/events/1']}>
        <Routes>
          <Route path="/events/:id" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Friday Night Constructed/i)).toBeInTheDocument()
    })

    // 1. Text is shown literally
    expect(screen.getByText(/<script>alert\(1\)<\/script><b>bold<\/b>/)).toBeInTheDocument()

    // 2. No <b> DOM element created inside the description
    expect(container.querySelector('b')).toBeNull()

    // 3. No script executed
    expect(alertSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('lint check: dangerouslySetInnerHTML count is strictly 0 across client/src', () => {
    const srcDir = path.resolve(__dirname, '../../src')
    function getFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...getFiles(full))
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(full)
        }
      }
      return files
    }

    const files = getFiles(srcDir)
    expect(files.length).toBeGreaterThan(0)
    let occurrences = 0
    for (const file of files) {
      const code = readFileSync(file, 'utf8')
      if (code.includes('dangerouslySetInnerHTML')) {
        occurrences++
      }
    }
    expect(occurrences).toBe(0)
  })
})
