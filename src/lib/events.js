/**
 * Cross-component events, named in one place so sender and listener can't drift.
 *
 * OPEN_SERVICE — detail is a CATALOGUE id ('student' | 'work' | 'visit').
 * Fired by the footer's service links; the catalogue opens that line.
 */
export const OPEN_SERVICE = 'skyline:open-service'
