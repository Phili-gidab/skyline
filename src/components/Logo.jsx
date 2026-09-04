import React from 'react'
import { BRAND } from '../data/site'

/**
 * The client's lockup.
 *
 * Mark, wordmark and "TRAVEL SOLUTION" are traced from their artwork
 * (tools/trace-logo.py) and served as SVG. The tagline is *not* traced: it is
 * only ~39px tall in the supplied raster and its letterforms are already
 * eroded there, so tracing reproduces the damage. It is set as live type
 * instead, which stays crisp at any size.
 *
 * Sizing is driven by the `--logo-w` custom property so the tagline scales
 * with the artwork rather than needing a size per usage.
 */
export default function Logo({ variant = 'full', className = '', ...rest }) {
  if (variant === 'compact') {
    return (
      <img
        className={`logo-compact ${className}`}
        src="/logo-compact.svg"
        alt={BRAND.name}
        {...rest}
      />
    )
  }

  return (
    <span className={`logo ${className}`} {...rest}>
      <img className="logo__art" src="/logo-lockup.svg" alt={BRAND.name} />
      <span className="logo__tagline">{BRAND.logoTagline}</span>
    </span>
  )
}
