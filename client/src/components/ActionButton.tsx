import React from 'react'
import type { ViewerAction } from '../api/types'

export interface ActionButtonProps {
  action: ViewerAction
  eventId: number
  registrationId?: number | null
  capacity?: number
  registeredCount?: number
}

export const ActionButton: React.FC<ActionButtonProps> = () => {
  return <div>Stub ActionButton</div>
}
