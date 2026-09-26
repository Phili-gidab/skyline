# Skyline Travel Solution — website

The website and office admin for a visa and travel consultancy on Bole Road, Addis Ababa.
Live at **[skyline-et.com](https://skyline-et.com)**, hosted on Yegara (cPanel).

The site is an **atlas**: a numbered index of the desks Skyline runs, with a route line that draws
itself down the page as you read, rows that open in place, and the service catalogue set as a
catalogue. Photography carries the places; type carries everything else.

## Stack

| Part | What |
| --- | --- |
| Build | Vite 5 + React 18 |
| Motion | GSAP + ScrollTrigger, Lenis for smooth scroll |
| Styles | one hand-written sheet, [src/styles/atlas.css](src/styles/atlas.css) |
| Admin | React + react-router, its own chunk under `/admin` |
| Backend | dependency-free PHP 8 + MySQL on cPanel ([php-api](php-api)) |

No UI framework, no CSS framework, no 3D. The whole site is **165 KB of JavaScript** (59 KB
gzipped) and a 22 KB stylesheet — it has to open on Ethiopian mobile data.

```bash
npm install
npm run dev       # localhost:5173, /api proxied to the PHP container
npm run build     # -> dist/
```

## The page

One scroll, seven plates, each its own component in [src/components](src/components):

| # | Section | What it does |
| --- | --- | --- |
| — | `Masthead` | The cover: the statement at plate size, the office facts, three photographs with captions |
| 01 | `Atlas` | The index of desks. The route line scrubs with scroll; a row opens in place; on a fine pointer the hovered desk's photograph follows the cursor |
| 02 | `Record` | The one dark plate — the figures, and why a file goes through the office |
| 03 | `Services` | The three service lines, numbered, with everything each includes |
| 04 | `Process` | Six steps as stations on the same line |
| 05 | `StudyOffer` | The scholarship offer sheet: award ladder, tuition before and after, and the application form |
| 06 | `Careers` | Open roles; applying opens a dialog with a CV upload |
| 07 | `Contact` | Office details and the enquiry form |

`Footer` closes on the deep emerald ground and carries the legal notice.

## Design system

Tokens sit at the top of [src/styles/atlas.css](src/styles/atlas.css).

- **Ground** `--paper #ffffff`, `--paper-2 #f5f4f0` for the sections that need separating
- **Ink** `--ink #101310`, with `--ink-2` / `--ink-3` for secondary and quiet text
- **Accent** `--emerald #0b7d3f` — one accent, nothing else. It is a shade deeper than the logo's
  `#0e8f47`, which reads at only 4.2:1 as small text on white
- **Dark plates** `--emerald-deep #07351f`. A section marked `.section--dark` (and the footer)
  re-points the ink and rule tokens rather than restating every rule, and the accent becomes
  `#6fd79b`, since the brand green cannot be read on that ground
- **Rules** are always 1px at 14% ink. The grid is meant to be visible; that is the atlas

**Three type voices, deliberately:**

| Voice | Font | Used for |
| --- | --- | --- |
| Grotesk | Inter Tight, 700, tight tracking | country names, section titles, figures |
| Serif | Instrument Serif | statements only — the standfirst, the footer line |
| Mono | JetBrains Mono | every label, code, count and caption |

A fourth voice (a script italic) was removed: at four voices nothing reads as deliberate.

## Motion

Scroll never *triggers* a set-piece. Everything is either a short entrance on arrival
(`.step`, `.mast__line`) or scrubbed to scroll position (the atlas route line). Anything longer
than about a second is scrubbed, so the reader is always in control of it.

`prefers-reduced-motion` collapses every animation and transition to 0.01ms at the foot of the
stylesheet.

## The logo

The client supplied only rasters (a 1280px PNG and a 640px JPG, both soft), so the artwork is
**traced** rather than redrawn — [`tools/trace-logo.py`](tools/trace-logo.py) recovers its real
outlines instead of approximating them:

```bash
python tools/trace-logo.py     # brand-source/*.png -> public/logo*.svg + favicon
```

Marching squares extracts sub-pixel contours at the alpha half-level, Douglas-Peucker simplifies
them, and each colour band becomes one even-odd path. Three details matter:

- **The source is upsampled 3x before tracing.** Marching squares interpolates between corner
  values, so tracing a Lanczos upsample of an antialiased edge gives genuinely smoother contours
  than tracing at native size.
- **Simplification is per band.** The tolerance that suits the mark destroys small type.
- **The two-tone wordmark is split by contour centroid, never by masking a column range.** Masking
  cut straight through the "Y" and left a visible seam where the two paths butted together.
  Splitting whole contours by centroid means a letter is never divided — 7 contours for 7 letters.

**The tagline is not traced.** It is only ~39px tall in the supplied raster and its letterforms are
already eroded there. It is set as live type in [`Logo.jsx`](src/components/Logo.jsx) instead.

| File | Use |
| --- | --- |
| `logo-lockup.svg` | mark + wordmark + TRAVEL SOLUTION, cream lettering — deep emerald grounds |
| `logo-lockup-color.svg` | same, original brand colour — white grounds |
| `logo-compact.svg` / `logo-compact-dark.svg` | mark + wordmark — light over emerald, dark over white |
| `favicon.svg` | the mark alone; anything with type is illegible at 32px |

If the client can get the original vector (AI/EPS/PDF), that is still better than any trace.

## Editing content

The office edits the site at **`/admin`** — contact details, the opening statement, destinations
(with photos), the service lines, additional services, process steps, the record figures, the study
offer, the legal notice and open roles.

[src/data/site.js](src/data/site.js) holds the built-in defaults: what the site shows with no admin
behind it, and the starting content the admin is loaded with on install (`npm run seed:export` →
`php-api/api/seed-data.json`). On each page load the saved content is fetched and written into those
same exports *before* the page mounts (`applyContent`), so nothing ever measures two versions. A
list that is empty or wholly hidden in the admin falls back to its default.

The client's service catalogue is the source of truth for services, destinations, process and
contact details. The PDF is served at `/skyline-service-catalogue.pdf` and linked from the footer;
replace that file when they issue a new edition.

## Admin and email

Built after the rtgeth project's CMS, which runs on cPanel shared hosting: a dependency-free PHP API
([php-api/api](php-api/api)) and MySQL beside the static site, and a React admin at `/admin`
([src/admin](src/admin)) loaded as its own chunk. Deployment and the email DNS setup:
**[docs/deploy-yegara.md](docs/deploy-yegara.md)**.

- **Content:** one schema list ([src/admin/schemas.js](src/admin/schemas.js)) drives the sidebar, the
  forms and the API. Singletons are JSON documents (`content`); every list is rows in one `items`
  table, so a new section needs no migration.
- **Forms:** a visa enquiry (Contact), a study application (Study) and a job application with a CV
  (Careers) post to `/api/submit`. Each is stored first, then the office is emailed (Reply-To the
  sender, CV attached) and the sender gets a confirmation. Staff answer from *Form submissions*.
  Honeypot plus a per-IP rate limit; no captcha.
- **Mail:** Resend, then the office's cPanel mailbox over SMTP, then PHP `mail()`; every attempt is
  in the *Email log*. The *Mailbox* receives through Resend's inbound webhook and replies in-thread.
- **Staff:** administrators and editors (editors cannot manage the team). No password is ever
  emailed — invitations and resets are one-time links. Disabling someone takes effect on their next
  request.
- **Differences from rtgeth, on purpose:** the Resend webhook refuses unsigned posts; no SVG uploads
  (an SVG can carry script, and the admin's session sits in the same origin); CVs and mail
  attachments live outside the web root and are served only to signed-in staff.
- **Locally:** `docker/` runs PHP 8.3 + Apache, MySQL and Mailpit (`npm run api:up`, then
  `npm run api:setup`). Mail lands at localhost:8025.

## Client boards and roles

The admin replaces the office's tracking spreadsheets with **boards**
([php-api/api/boards.php](php-api/api/boards.php), [src/admin/pages/Board.jsx](src/admin/pages/Board.jsx)):
typed columns (status, person, date, money, dropdown, checkbox, password…), groups such as intakes, a
table and a kanban view, updates on each client and a complete activity trail. A website submission
becomes a client with one click, documents included.

Five roles, enforced on the server (`CAPS` in [lib.php](php-api/api/lib.php)), never just hidden in the
menu:

| | Admin | Manager | Agent | Front desk | Editor |
| --- | --- | --- | --- | --- | --- |
| Clients on the boards | all | all | only their own | all | — |
| Money columns | ✓ | ✓ | — | — | — |
| Clients' portal passwords | ✓ | — | own clients | — | — |
| Submissions and mailbox | ✓ | ✓ | — | ✓ | — |
| Website content | ✓ | ✓ | — | — | ✓ |
| Team and board setup | ✓ | — | — | — | — |

An agent asking for someone else's client gets *not found*, not *forbidden*: they cannot learn who else
is on the books. Clients' portal passwords are sealed with AES-256-GCM (`seal()` / `unseal()`), the key
is `SECRETS_KEY` in the server config and nowhere else, and every reveal is written to the item's
activity with who and when.

## Deploying

The site is built here and uploaded; nothing is compiled on the server.

```bash
npm run build
# upload the contents of dist/ into public_html/ (including the hidden .htaccess)
```

`php-api/api/*` goes in `public_html/api/`, the config lives **outside** the web root at
`~/skyline-api-config.php`, and CVs and mail attachments live in `~/skyline-private/`. The full
runbook, including the MySQL setup and the Resend DNS records, is in
[docs/deploy-yegara.md](docs/deploy-yegara.md).

## Before this goes live

**Resolved by the client's service catalogue (received 2026-09-10):** the phone numbers, the office
address, and which tagline is current — "You Belong Everywhere", now used site-wide. Japan and
France were flyer desks the catalogue does not list, so they are gone.

Still open:

1. **Study section.** It presents Post University in Connecticut with a Fall 2026 intake. The
   catalogue's study destinations are Italy, Austria, Hungary and China; the USA appears only as a
   visit destination. Confirm the partnership is still live.
2. **Hungary** is a study destination in the catalogue but was not in the destinations list sent with
   it. It appears in the service catalogue only, not in the atlas index.
3. **Processing times** and the no-prepayment terms come from the flyers. The catalogue gives
   neither — confirm they still hold.
4. **Email spelling.** The flyers show both `managmentskyline@gmail.com` and
   `managementskyline@gmail.com`. It now appears only on Careers, as the CV inbox.
5. **Office hours** are a placeholder — confirm them with the office, who can set them in the admin
   (Contact & brand).
6. **The `500+` figure** is derived from the flyer's "hundreds of successful visas". Confirm or
   replace.
7. **Destination photography** is hot-linked Unsplash imagery (Armenia is from Pexels, because none
   of the Unsplash candidates actually showed Armenia). Replace with owned or licensed photography
   before launch. Captions name where each photo was taken — Ireland is Cobh, Brazil is Rio — while
   the index badge is the country's gateway airport. Photos are requested at the width they are
   shown via `srcset` (`photoSrcSet` in `site.js`).
8. **Insurance.** The additional-services list carried both "Travel insurance" and "Insurance"; only
   the first is shown. If the second meant something different, add it to `EXTRA_SERVICES`.
9. The flyers' "100% success rate" claim is deliberately **not** repeated. The catalogue's own
   notice — shown under the service catalogue and in the footer — says outcomes cannot be
   guaranteed.
10. **The logo is a trace** from a low-resolution raster. Ask the client's designer for the source
    vector.
