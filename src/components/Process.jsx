import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { PROCESS } from '../data/site'

/* Six steps, read as a run of stations — the same line as the atlas, laid
 * on its side.
 */
export default function Process() {
  const root = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.step',
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: '.steps', start: 'top 78%' },
        }
      )
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="section process" id="process" ref={root}>
      <div className="section__head">
        <div>
          <span className="section__no">04 — How it runs</span>
          <h2 className="section__title">
            From the first call
            <br />
            to the airport
          </h2>
        </div>
        <p className="section__aside">
          The same order every time, whichever desk you are on. You are told what is happening at
          each stage, and what it depends on.
        </p>
      </div>

      <ol className="steps">
        {PROCESS.map((s) => (
          <li className="step" key={s.n}>
            <span className="step__n">{s.n}</span>
            <h3 className="step__title">{s.title}</h3>
            <p className="step__body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
