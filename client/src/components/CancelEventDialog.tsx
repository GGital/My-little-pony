import React from 'react'
import type { EventDetail } from '../api/types'

export interface CancelEventDialogProps {
  eventId: number
  registeredCount: number
  onClose: () => void
  onCancelled: (event: EventDetail) => void
}

// STUB (S2-05 commit A): renders nothing, so TEST-O-03 (C) fails on its assertions until commit B.
export const CancelEventDialog: React.FC<CancelEventDialogProps> = () => null
