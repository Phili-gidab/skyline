import React, { useEffect, useRef, useState } from 'react'

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789→ '

/**
 * Solari-style split-flap display. Each cell riffles through the charset
 * and settles left to right, so a value change reads as mechanical.
 */
export default function SplitFlap({ value, length, className = '', tick = 45, step = 55 }) {
  const width = length ?? value.length
  const target = value.padEnd(width, ' ').slice(0, width)

  const settled = useRef(target.split('').map(() => true))
  const [chars, setChars] = useState(() => target.split(''))
  const [, force] = useState(0)

  useEffect(() => {
    const cells = target.split('')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settled.current = cells.map(() => true)
      setChars(cells)
      return
    }

    settled.current = cells.map(() => false)
    force((n) => n + 1)

    const interval = setInterval(() => {
      setChars((prev) =>
        prev.map((c, i) =>
          settled.current[i] ? c : CHARSET[Math.floor(Math.random() * CHARSET.length)]
        )
      )
    }, tick)

    // settle the cells one after another, left to right
    const timeouts = cells.map((ch, i) =>
      setTimeout(() => {
        settled.current[i] = true
        setChars((prev) => {
          const next = [...prev]
          next[i] = ch
          return next
        })
      }, 220 + i * step)
    )

    const stop = setTimeout(() => clearInterval(interval), 320 + cells.length * step)

    return () => {
      clearInterval(interval)
      clearTimeout(stop)
      timeouts.forEach(clearTimeout)
    }
  }, [target, tick, step])

  return (
    <span className={`flap ${className}`} aria-label={value}>
      {chars.map((c, i) => (
        <span
          key={i}
          className={`flap__cell ${settled.current[i] ? '' : 'is-spinning'}`}
          aria-hidden="true"
        >
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  )
}
