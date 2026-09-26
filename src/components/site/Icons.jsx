import React from 'react'

/* Plain stroke icons, drawn inline so there is no icon font to load. */
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const Check = (p) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const Arrow = (p) => (
  <svg {...base} width={18} height={18} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const Phone = (p) => (
  <svg {...base} {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </svg>
)

export const Mail = (p) => (
  <svg {...base} {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </svg>
)

export const Pin = (p) => (
  <svg {...base} {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

export const Clock = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const Chat = (p) => (
  <svg {...base} {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.7-.8L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
  </svg>
)

export const Cap = (p) => (
  <svg {...base} width={26} height={26} {...p}>
    <path d="M22 9 12 4 2 9l10 5 10-5Z" />
    <path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
  </svg>
)

export const Work = (p) => (
  <svg {...base} width={26} height={26} {...p}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
)

export const Plane = (p) => (
  <svg {...base} width={26} height={26} {...p}>
    <path d="M17.8 19.8 16 14l4-4a2.1 2.1 0 0 0-3-3l-4 4-5.8-1.8a1 1 0 0 0-1 1.6L9 13l-2 2-2.5-.4a1 1 0 0 0-.9 1.7l2.6 2.6a1 1 0 0 0 1.7-.9L7.5 15l2-2 2.2 2.8a1 1 0 0 0 1.6-1Z" />
  </svg>
)

export const Shield = (p) => (
  <svg {...base} {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
