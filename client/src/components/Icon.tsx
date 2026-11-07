import React from 'react'

/** The one drawn icon set (design-direction §8): 24 px grid, 1.75 px stroke, round caps. Paths from docs/ui/mockup.html. */
const PATHS = {
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-5.8 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.2 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  trophy: (
    <path d="M8 4h8v5.5a4 4 0 0 1-8 0V4zM8 6.5H5.5a2.5 2.5 0 0 0 2.6 3.2M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3.2M12 13.5V17M8.5 20.5h7M10 17h4v3.5h-4z" />
  ),
  fee: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M4 7.5l8 6 8-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3a5.5 5.5 0 0 1 3 5.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chev: <path d="M7 10l5 5 5-5" />,
  alert: <path d="M12 4.5l8.5 15h-17zM12 10v4.2M12 17.2v.1" />,
  arrow: <path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5" />,
  spin: <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.2 8.8l-1.9 4.5-4.5 1.9 1.9-4.5z" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

export const Icon: React.FC<{ name: IconName; size?: 'sm'; spin?: boolean; className?: string }> = ({
  name,
  size,
  spin,
  className = '',
}) => (
  <svg
    className={`i${size ? ' i--sm' : ''}${spin ? ' i--spin' : ''} ${className}`.trim()}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[name]}
  </svg>
)
