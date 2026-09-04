import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

/**
 * Difference-blend cursor. Any element carrying `data-cursor="Label"`
 * expands the ring and prints its label inside.
 */
export default function Cursor() {
  const wrap = useRef(null)
  const dot = useRef(null)
  const ring = useRef(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return

    gsap.set([dot.current, ring.current], { xPercent: -50, yPercent: -50 })

    const dotX = gsap.quickTo(dot.current, 'x', { duration: 0.12, ease: 'power3' })
    const dotY = gsap.quickTo(dot.current, 'y', { duration: 0.12, ease: 'power3' })
    const ringX = gsap.quickTo(ring.current, 'x', { duration: 0.55, ease: 'power3' })
    const ringY = gsap.quickTo(ring.current, 'y', { duration: 0.55, ease: 'power3' })

    const onMove = (e) => {
      dotX(e.clientX)
      dotY(e.clientY)
      ringX(e.clientX)
      ringY(e.clientY)
    }

    const onOver = (e) => {
      const target = e.target.closest('[data-cursor], a, button')
      if (!target) return
      const text = target.getAttribute('data-cursor')
      setLabel(text || '')
      wrap.current?.classList.add('is-hover')
    }

    const onOut = (e) => {
      const target = e.target.closest('[data-cursor], a, button')
      if (!target) return
      if (target.contains(e.relatedTarget)) return
      setLabel('')
      wrap.current?.classList.remove('is-hover')
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
    }
  }, [])

  return (
    <div className="cursor" ref={wrap} aria-hidden="true">
      <div className="cursor__ring" ref={ring}>
        <span className="cursor__label">{label}</span>
      </div>
      <div className="cursor__dot" ref={dot} />
    </div>
  )
}
