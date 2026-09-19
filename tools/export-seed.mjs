// Writes php-api/api/seed-data.json from src/data/site.js, so the admin starts
// from exactly what the site shows today. Setup loads it once and never
// overwrites edits made since. Run: npm run seed:export
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as site from '../src/data/site.js'

const B = site.BRAND

const seed = {
  singles: {
    brand: {
      tagline: B.tagline,
      mission: B.mission,
      address: B.address,
      landmark: B.landmark,
      mapsQuery: B.mapsQuery,
      whatsapp: B.whatsapp,
      telegram: B.telegram,
      instagram: B.instagram,
      email: B.email,
      phones: B.phones.map(({ display, tel }) => ({ display, tel })),
      hours: B.hours,
      hoursNote: B.hoursNote,
      catalogueUrl: B.catalogueUrl,
    },
    hero: { ...site.HERO },
    scholarship: {
      school: site.SCHOLARSHIP.school,
      location: site.SCHOLARSHIP.location,
      founded: site.SCHOLARSHIP.founded,
      intake: site.SCHOLARSHIP.intake,
      programs: site.SCHOLARSHIP.programs,
      tiers: site.SCHOLARSHIP.tiers,
    },
    notice: { text: site.NOTICE },
  },
  collections: {
    destinations: site.DESTINATIONS.map(({ id, country, city, iata, board, services, blurb, points, photo }) => ({
      slug: id, country, city, iata, board, services, blurb, points, photo,
    })),
    catalogue: site.CATALOGUE.map(({ id, title, ask, lead, includes, destinations, note }) => ({
      slug: id, title, ask, lead, includes, destinations, note,
    })),
    extras: site.EXTRA_SERVICES.map((title) => ({ title })),
    why: site.WHY.map(({ title, body }) => ({ title, body })),
    process: site.PROCESS.map(({ title, body }) => ({ title, body })),
    // the raw values, so "#destinations" stays a live count after edits
    stats: site.STATS_RAW.map(({ value, suffix, label, status }) => ({ value: String(value), suffix, label, status })),
    specs: site.SPECS_RAW.map(({ value, unit, label }) => ({ value, unit, label })),
    roles: site.ROLES.map(({ title, type, body }) => ({ title, type, body })),
  },
}

const out = fileURLToPath(new URL('../php-api/api/seed-data.json', import.meta.url))
writeFileSync(out, JSON.stringify(seed, null, 2) + '\n')
console.log(
  `seed-data.json: ${Object.keys(seed.singles).length} sections, ` +
    Object.entries(seed.collections).map(([k, v]) => `${k} ${v.length}`).join(', ')
)
