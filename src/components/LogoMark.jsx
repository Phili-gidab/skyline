import React from 'react'

/**
 * Skyline Travel Solution — the aircraft-and-swoosh mark, redrawn as vector.
 *
 * Traced from the client's raster logo (1280px PNG / 640px JPG, both soft),
 * so this is a clean redraw rather than an autotrace: the swoosh is two
 * tapered crescents and the aircraft is a single closed outline. Geometry was
 * measured off the source bitmap, hence the viewBox — 0 0 390 200 corresponds
 * to x 100..490, y 95..295 in the 640px original.
 *
 * Brand greens sampled from the source: #0E8F47 dark, #23AD68 light.
 */

export const BRAND_GREEN_DARK = '#0e8f47'
export const BRAND_GREEN_LIGHT = '#23ad68'

export default function LogoMark({
  className,
  title = 'Skyline Travel Solution',
  // `currentColor` lets the mark inherit the nav / footer colour;
  // pass explicit greens for the full-colour lockup.
  dark = 'currentColor',
  light = 'currentColor',
  ...rest
}) {
  return (
    <svg
      viewBox="0 0 390 200"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {/* outer swoosh — tapered crescent, tail running down to the left */}
      <path
        d="M14 197
           C 34 147 84 99 141 77
           C 191 57 259 56 333 82
           L 327 98
           C 258 75 196 78 150 97
           C 100 118 57 156 28 200
           Z"
        fill={light}
      />

      {/* inner swoosh — the shorter echo beneath it */}
      <path
        d="M80 167
           C 93 137 123 117 159 114
           C 191 111 217 121 235 140
           L 224 150
           C 206 136 184 129 161 132
           C 132 136 110 152 95 173
           Z"
        fill={light}
      />

      {/* Aircraft: fin up, one wing swept right, tail down to the left.
          The long edges are near-straight — the source mark is a sharp,
          swept form, and curving these is what makes it read as a starfish. */}
      <path
        d="M318 8
           C 322 24 328 44 331 62
           C 333 76 334 88 337 98
           C 350 108 363 118 375 128
           C 378 131 377 136 371 137
           C 363 138 354 139 348 138
           C 341 135 334 132 329 130
           C 318 135 308 139 300 143
           C 283 155 266 167 251 177
           C 246 180 242 177 243 170
           C 248 159 255 148 262 138
           C 270 129 278 120 285 112
           C 268 107 252 101 237 96
           C 233 94 233 90 238 88
           C 258 82 282 79 300 78
           C 303 58 307 32 311 14
           C 313 6 316 2 318 8
           Z"
        fill={dark}
      />
    </svg>
  )
}
