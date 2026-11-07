import React from 'react'
import { Icon } from './Icon'

/** Inline message: error (red), success (teal) or info (violet). Errors are announced (role="alert"). */
export const Notice: React.FC<{
  tone: 'error' | 'success' | 'info'
  children: React.ReactNode
  onClose?: () => void
  role?: 'alert' | 'status'
}> = ({ tone, children, onClose, role = tone === 'error' ? 'alert' : 'status' }) => (
  <div className={`notice notice--${tone}`} role={role}>
    <Icon name={tone === 'error' ? 'alert' : 'check'} />
    <span className="notice__body">{children}</span>
    {onClose && (
      <button type="button" className="notice__close" onClick={onClose} aria-label="Close">
        <Icon name="close" size="sm" />
      </button>
    )}
  </div>
)
