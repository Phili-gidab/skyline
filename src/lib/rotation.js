import { useEffect, useState } from 'react'
import { DESTINATIONS } from '../data/site'

/**
 * Which desk the hero is showing.
 *
 * The photograph and the departure board have to name the same place, so
 * neither keeps its own clock. HeroPhoto advances this only once the next
 * photograph has actually decoded — on a slow connection the board simply
 * holds the current desk for longer instead of announcing a picture that
 * has not arrived.
 */
export const BOARD_INTERVAL = 6200

let index = 0
const listeners = new Set()

export const desk = () => DESTINATIONS[index]
export const nextIndex = () => (index + 1) % DESTINATIONS.length

export function showDesk(i) {
  index = ((i % DESTINATIONS.length) + DESTINATIONS.length) % DESTINATIONS.length
  listeners.forEach((notify) => notify(desk()))
}

export function useDesk() {
  const [d, setD] = useState(desk)
  useEffect(() => {
    listeners.add(setD)
    setD(desk())
    return () => {
      listeners.delete(setD)
    }
  }, [])
  return d
}
