/**
 * Cross-component events, named in one place so sender and listener can't drift.
 *
 * OPEN_SERVICE — detail is a CATALOGUE id ('student' | 'work' | 'visit').
 * Fired by the footer's service links; the catalogue opens that line.
 *
 * NAV_TONE — detail is 'light' | 'dark': what is under the nav bar.
 * Fired by Study, the one light section. It opens with a dark fly-over, so
 * only Study knows when its cream is actually showing; the nav swaps its
 * logo and ink to match.
 */
export const OPEN_SERVICE = 'skyline:open-service'
export const NAV_TONE = 'skyline:nav-tone'
