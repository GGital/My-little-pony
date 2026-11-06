import React from 'react'
import { NavLink } from 'react-router-dom'

export interface PageTopProps {
  title: React.ReactNode
  /** One line under the title, e.g. the host of an event. */
  subtitle?: React.ReactNode
  /** Shown at the right of the title row (a primary action). */
  action?: React.ReactNode
  /** Page tabs (design-direction §1: Find an Event / My Events). */
  tabs?: { to: string; label: string }[]
}

/** The white top of the main panel: title, optional action, optional tabs (design-direction §3). */
export const PageTop: React.FC<PageTopProps> = ({ title, subtitle, action, tabs }) => (
  <div className={`ptop${tabs ? ' ptop--tabs' : ''}`}>
    <div className="ptop__row">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="host">{subtitle}</p>}
      </div>
      {action}
    </div>
    {tabs && (
      <nav className="tabs" aria-label="Events">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end>
            {t.label}
          </NavLink>
        ))}
      </nav>
    )}
  </div>
)

/** Tabs for the two participant event pages. */
export const EVENT_TABS = [
  { to: '/events', label: 'Find an Event' },
  { to: '/me/registrations', label: 'My Events' },
]
