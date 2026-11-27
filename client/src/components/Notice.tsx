import React from 'react'
import { Icon } from './Icon'

/** Inline message: error (red), success (teal), info (violet) or warning (amber). Errors are announced (role="alert"). */
export const Notice: React.FC<{
  tone: 'error' | 'success' | 'info' | 'warning'
  children: React.ReactNode
  onClose?: () => void
  role?: 'alert' | 'status'
  /** Lets a page move focus to the message (contracts: sign-in 429). Makes the box focusable by script only. */
  boxRef?: React.Ref<HTMLDivElement>
}> = ({ tone, children, onClose, boxRef, role = tone === 'error' ? 'alert' : 'status' }) => (
  <div className={`notice notice--${tone}`} role={role} ref={boxRef} tabIndex={boxRef ? -1 : undefined}>
    <Icon name={tone === 'error' || tone === 'warning' ? 'alert' : 'check'} />
    <span className="notice__body">{children}</span>
    {onClose && (
      <button type="button" className="notice__close" onClick={onClose} aria-label="Close">
        <Icon name="close" size="sm" />
      </button>
    )}
  </div>
)
