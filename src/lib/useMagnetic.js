import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * Magnetic hover: the element eases toward the pointer while it is inside
 * an expanded hit area, and springs back on leave.
 */
export function useMagnetic({ strength = 0.4, innerStrength = 0.22, radius = 1.6 } = {}) {
  const ref = useRef(null)
  const innerRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(hover: none)').matches) return

    const xTo = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'elastic.out(1, 0.4)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'elastic.out(1, 0.4)' })
    const inner = innerRef.current
    const ixTo = inner && gsap.quickTo(inner, 'x', { duration: 1.1, ease: 'elastic.out(1, 0.4)' })
    const iyTo = inner && gsap.quickTo(inner, 'y', { duration: 1.1, ease: 'elastic.out(1, 0.4)' })

    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      const max = (Math.max(rect.width, rect.height) / 2) * radius

      if (dist < max) {
        xTo(dx * strength)
        yTo(dy * strength)
        if (ixTo) {
          ixTo(dx * innerStrength)
          iyTo(dy * innerStrength)
        }
      } else {
        xTo(0)
        yTo(0)
        if (ixTo) {
          ixTo(0)
          iyTo(0)
        }
      }
    }

    const onLeave = () => {
      xTo(0)
      yTo(0)
      if (ixTo) {
        ixTo(0)
        iyTo(0)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [strength, innerStrength, radius])

  return { ref, innerRef }
}
