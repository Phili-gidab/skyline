import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { BRAND, DESTINATIONS, HERO, CATALOGUE, photoSrc, photoSrcSet } from '../data/site'
import { scrollTo } from '../lib/smooth'

/* The cover plate.
 *
 * An atlas opens with its title and a first plate: the name at full size, the
 * standfirst beside it, and three photographs across the foot with their
 * captions — enough to say what this place is before a single scroll.
 */
export default function Masthead() {
  const root = useRef(null)
  const plates = [DESTINATIONS[0], DESTINATIONS[4], DESTINATIONS[7]].filter(Boolean)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.fromTo('.mast__meta > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06 })
        .fromTo(
          '.mast__line span',
          { yPercent: 108 },
          { yPercent: 0, duration: 1.3, stagger: 0.08 },
          '-=0.6'
        )
        .fromTo(
          ['.mast__say', '.mast__facts', '.mast__actions'],
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 1, stagger: 0.08 },
          '-=0.85'
        )
        .fromTo(
          '.plate',
          { clipPath: 'inset(0 0 100% 0)' },
          { clipPath: 'inset(0 0 0% 0)', duration: 1.2, stagger: 0.09 },
          '-=0.8'
        )
    }, root)
    return () => ctx.revert()
  }, [])

  const title = HERO.title.replace(/\.$/, '')
  const words = title.split(' ')
  // short statements read better broken two to a line; longer ones need three
  const per = words.length <= 6 ? 2 : 3

  return (
    <header className="mast" id="top" ref={root}>
      <div className="mast__meta">
        <span className="label">
          {BRAND.city} — {BRAND.country}
        </span>
        <span className="label">
          {DESTINATIONS.length} desks / {CATALOGUE.length} service lines
        </span>
      </div>

      <h1 className="mast__title">
        {words.reduce((lines, word, i) => {
          const at = Math.floor(i / per)
          lines[at] = lines[at] ? `${lines[at]} ${word}` : word
          return lines
        }, []).map((line) => (
          <span className="mast__line" key={line}>
            <span>{line}</span>
          </span>
        ))}
      </h1>

      <div className="mast__lower">
        <p className="mast__say statement">{HERO.subtitle}</p>

        <dl className="mast__facts">
          <div>
            <dt className="label">Office</dt>
            <dd>{BRAND.address}</dd>
          </div>
          <div>
            <dt className="label">Landmark</dt>
            <dd>{BRAND.landmark}</dd>
          </div>
          <div>
            <dt className="label">Payable now</dt>
            <dd>0 birr</dd>
          </div>
        </dl>

        <div className="mast__actions">
          <a
            className="btn btn--solid"
            href="#enquiry"
            onClick={(e) => {
              e.preventDefault()
              scrollTo('#enquiry')
            }}
          >
            Open a file <i>↗</i>
          </a>
          <a
            className="btn btn--ghost"
            href="#destinations"
            onClick={(e) => {
              e.preventDefault()
              scrollTo('#destinations')
            }}
          >
            See the desks
          </a>
        </div>
      </div>

      <div className="mast__plates">
        {plates.map((d, i) => (
          <figure className="plate-fig" key={d.id}>
            <div className="plate">
              <img
                src={photoSrc(d.photo, 900)}
                srcSet={photoSrcSet(d.photo, [480, 720, 960])}
                sizes="(max-width: 860px) 86vw, 32vw"
                alt={`${d.city}, ${d.country}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
            <figcaption>
              <span className="label">Plate {String(i + 1).padStart(2, '0')}</span>
              <span>
                {d.board} — {d.country}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </header>
  )
}
