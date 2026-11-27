import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CancelEventDialog } from '../../src/components/CancelEventDialog'

// TEST-O-03 (C) · AC-O-03, UX-12 (Sprint 2 contracts §6): the cancel dialog. A required reason with a 5–200
// counter, the number of affected players, and a red CANCEL EVENT button that waits until the reason is long enough.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const renderDialog = (over: Partial<React.ComponentProps<typeof CancelEventDialog>> = {}) => {
  const props = { eventId: 7, registeredCount: 3, onClose: vi.fn(), onCancelled: vi.fn(), ...over }
  render(<CancelEventDialog {...props} />)
  return props
}
const reasonBox = () => screen.getByLabelText('Reason')
const send = () => screen.getByRole('button', { name: /CANCEL EVENT|Cancelling…/ })

afterEach(() => vi.restoreAllMocks())

describe('TEST-O-03 (C) CancelEventDialog (AC-O-03, UX-12)', () => {
  it('shows the warning with the number of registered players and a counter starting at 0 / 200', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/This can't be undone\. All 3 registered players will see the event as cancelled\./)).toBeInTheDocument()
    expect(screen.getByText('0 / 200')).toBeInTheDocument()
  })

  it('says "1 registered player" in the singular', () => {
    renderDialog({ registeredCount: 1 })
    expect(screen.getByText(/All 1 registered player will see the event as cancelled\./)).toBeInTheDocument()
  })

  it('keeps CANCEL EVENT disabled below 5 characters (spaces do not count), and enables it at 5', () => {
    renderDialog()
    expect(send()).toBeDisabled()
    fireEvent.change(reasonBox(), { target: { value: 'abcd' } })
    expect(screen.getByText('4 / 200')).toBeInTheDocument()
    expect(send()).toBeDisabled()
    fireEvent.change(reasonBox(), { target: { value: '   abcd   ' } })
    expect(send()).toBeDisabled()
    fireEvent.change(reasonBox(), { target: { value: 'abcde' } })
    expect(send()).toBeEnabled()
  })

  it('stops the reason at 200 characters', () => {
    renderDialog()
    fireEvent.change(reasonBox(), { target: { value: 'x'.repeat(250) } })
    expect((reasonBox() as HTMLTextAreaElement).value).toHaveLength(200)
    expect(screen.getByText('200 / 200')).toBeInTheDocument()
  })

  it('sends the trimmed reason to E-15, shows "Cancelling…" meanwhile, then calls onCancelled with the event', async () => {
    let finish: (r: Response) => void = () => {}
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const props = renderDialog()

    fireEvent.change(reasonBox(), { target: { value: '  Store closed for renovation.  ' } })
    fireEvent.click(send())

    expect(await screen.findByRole('button', { name: 'Cancelling…' })).toBeDisabled()
    expect(spy).toHaveBeenCalledWith(
      '/api/organizer/events/7/cancel',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'Store closed for renovation.' }) }),
    )
    finish(json(200, { id: 7, status: 'CANCELLED', cancelReason: 'Store closed for renovation.' }))
    await waitFor(() => expect(props.onCancelled).toHaveBeenCalledWith(expect.objectContaining({ id: 7, status: 'CANCELLED' })))
  })

  it("shows the server's reason when E-15 refuses and keeps the dialog open with the text kept", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(409, { error: { code: 'EVENT_STARTED', message: 'This event has already started.' } }),
    )
    const props = renderDialog()
    fireEvent.change(reasonBox(), { target: { value: 'Store closed for renovation.' } })
    fireEvent.click(send())

    expect(await screen.findByText('This event has already started.')).toBeInTheDocument()
    expect(props.onCancelled).not.toHaveBeenCalled()
    expect((reasonBox() as HTMLTextAreaElement).value).toBe('Store closed for renovation.')
    expect(send()).toBeEnabled()
  })

  it('Keep event (and Escape) closes without calling the server', () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const props = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Keep event' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(2)
    expect(spy).not.toHaveBeenCalled()
  })
})
