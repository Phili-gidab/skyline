/**
 * Site content.
 *
 * Source of truth, in order of precedence:
 *   1. The client's service catalogue (public/skyline-service-catalogue.pdf,
 *      received 2026-09-10) and the contact block they sent with it.
 *   2. Their earlier Telegram/Instagram flyers, for anything the catalogue
 *      does not cover — the processing times and the no-prepayment terms.
 */

export const BRAND = {
  name: 'Skyline Travel Solution',
  short: 'Skyline',
  tagline: 'You Belong Everywhere',
  // the tagline as set inside the logo artwork
  logoTagline: 'You belong Everywhere!',
  mission:
    'To provide professional, transparent and client-focused support for international study, work and travel opportunities.',
  city: 'Addis Ababa',
  country: 'Ethiopia',
  address: '22 Bole Road, Bimmer, Office 704',
  landmark: 'In front of Awaris Hotel',
  mapsQuery: '22 Bole Road, Awaris Hotel, Addis Ababa',
  timezone: 'Africa/Addis_Ababa',
  telegram: 'SKYLINE_TRAVEL_SOLUTION',
  telegramUrl: 'https://t.me/SKYLINE_TRAVEL_SOLUTION',
  whatsapp: '+251 921 470 395',
  whatsappUrl: 'https://wa.me/251921470395',
  instagram: 'skyline.travel.so',
  instagramUrl: 'https://instagram.com/skyline.travel.so',
  // the careers inbox, from the hiring flyer — not part of the public contact block
  email: 'managmentskyline@gmail.com',
  phones: [
    { display: '011 666 2806', tel: '+251116662806' },
    { display: '098 497 5570', tel: '+251984975570' },
    { display: '098 886 6060', tel: '+251988866060' },
  ],
  catalogueUrl: '/skyline-service-catalogue.pdf',
}

/** A WhatsApp link that opens with a message already typed. */
export const whatsappLink = (text) => `${BRAND.whatsappUrl}?text=${encodeURIComponent(text)}`

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']

/** 10 -> "Ten", for headings that count something in this file. */
export const countWord = (n) => NUMBER_WORDS[n] ?? String(n)

/* ----------------------------------------------------------------------
   Destinations, in the order the client listed them.

   iata / board — the country's main gateway airport. It is the "route" on
   the departure board and the card badge.
   city — where the card's photograph was taken, so the caption is always
   true to the picture. Every photo was checked by eye, not just for a 200.
   ---------------------------------------------------------------------- */

// Base URLs only: both CDNs resize on the fly via ?w=, so the card asks for the
// width it is actually shown at (see photoSrcSet) rather than a fixed 1400px.
const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=70`

const SERVICE_WORD = { Study: 'study', Work: 'work', Visit: 'visit' }

function kindOf(services) {
  if (services.length === 1) return services[0] === 'Study' ? 'Student visa' : `${services[0]} visa`
  const words = services.map((s) => SERVICE_WORD[s])
  const list =
    words.length === 2 ? words.join(' and ') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
  return `${list[0].toUpperCase()}${list.slice(1)} visas`
}

const DESTINATION_LIST = [
  {
    id: 'italy',
    country: 'Italy / Schengen',
    city: 'Rome',
    iata: 'FCO',
    board: 'ROMA',
    services: ['Study', 'Work', 'Visit'],
    blurb:
      'The one desk that runs all three service lines: university admission, employer-sponsored work permits and Schengen visit visas.',
    points: [
      'Admission and CIMEA / DOV guidance',
      'Work permit application guidance',
      'Schengen visit visa files',
      'Embassy and VFS appointments',
    ],
    photo: photo('photo-1552832230-c0197dd311b5'),
  },
  {
    id: 'ireland',
    country: 'Ireland',
    city: 'Cobh, County Cork',
    iata: 'DUB',
    board: 'DUBLIN',
    services: ['Visit'],
    blurb:
      'Visit visas for tourism, family visits, business and events, built from a personalised checklist and reviewed before lodging.',
    points: [
      'Personalised document checklist',
      'Invitation-letter guidance',
      'Financial-document review',
      'Cover letter preparation',
    ],
    photo: photo('photo-1590089415225-401ed6f9db8e'),
  },
  {
    id: 'armenia',
    country: 'Armenia',
    city: 'Yerevan',
    iata: 'EVN',
    board: 'YEREVAN',
    services: ['Visit'],
    blurb:
      'Visit visa applications prepared from the application form to the travel itinerary, and organised into one complete file.',
    points: [
      'Application form guidance',
      'Flight itinerary guidance',
      'Accommodation documentation',
      'Application file organisation',
    ],
    // Pexels (free for commercial use), not Unsplash — none of the Unsplash
    // candidates for Armenia actually showed Armenia
    photo: 'https://images.pexels.com/photos/30454809/pexels-photo-30454809.jpeg?auto=compress&cs=tinysrgb',
  },
  {
    id: 'turkey',
    country: 'Turkey',
    city: 'Istanbul',
    iata: 'IST',
    board: 'ISTANBUL',
    services: ['Work', 'Visit'],
    blurb:
      'Employer-sponsored work permits and visit visas. Work availability depends on current immigration rules and employer sponsorship.',
    points: [
      'Work eligibility guidance',
      'Employer and document review',
      'Visit visa preparation',
      'Pre-departure preparation',
    ],
    photo: photo('photo-1541432901042-2d8bd64b4a9b'),
  },
  {
    id: 'canada',
    country: 'Canada',
    city: 'Toronto',
    iata: 'YYZ',
    board: 'TORONTO',
    services: ['Visit'],
    blurb:
      'Visit visas for tourism, family visits and business trips, with financial documents reviewed and the file organised before your appointment.',
    points: [
      'Visa eligibility assessment',
      'Financial-document review',
      'Travel insurance guidance',
      'Embassy / VFS appointments',
    ],
    photo: photo('photo-1517090504586-fde19ea6066f'),
  },
  {
    id: 'usa',
    country: 'United States',
    city: 'New York',
    iata: 'JFK',
    board: 'NEW YORK',
    services: ['Visit'],
    blurb:
      'Visit visa preparation for tourism, family visits, business and events: application form guidance, a cover letter and an organised file.',
    points: [
      'Application form preparation',
      'Cover letter preparation',
      'Financial-document review',
      'Embassy appointment guidance',
    ],
    photo: photo('photo-1485871981521-5b1fd3805eee'),
  },
  {
    id: 'brazil',
    country: 'Brazil',
    city: 'Rio de Janeiro',
    iata: 'GRU',
    board: 'SAO PAULO',
    services: ['Visit'],
    blurb:
      'Visit visas for holidays, family visits and events, with itinerary, accommodation and insurance documents prepared alongside the application.',
    points: [
      'Flight itinerary guidance',
      'Accommodation documentation',
      'Travel insurance guidance',
      'Travel preparation',
    ],
    photo: photo('photo-1483729558449-99ef09a8c325'),
  },
  {
    id: 'mexico',
    country: 'Mexico',
    city: 'Mexico City',
    iata: 'MEX',
    board: 'MEXICO',
    services: ['Visit'],
    blurb:
      'Tourist and business visit visas, prepared from a personalised checklist and organised into a complete application file.',
    points: [
      'Personalised document checklist',
      'Invitation-letter guidance',
      'Cover letter preparation',
      'Application file organisation',
    ],
    photo: photo('photo-1585464231875-d9ef1f5ad396'),
  },
  {
    id: 'austria',
    country: 'Austria',
    city: 'Vienna',
    iata: 'VIE',
    board: 'WIEN',
    services: ['Study'],
    blurb:
      'University and course selection, admission applications and scholarship guidance, through to the visa file and pre-departure.',
    points: [
      'University and course selection',
      'Admission application support',
      'Motivation letter and CV support',
      'Pre-enrollment guidance',
    ],
    photo: photo('photo-1516550893923-42d28e5677af'),
  },
  {
    id: 'china',
    country: 'China',
    city: 'Beijing',
    iata: 'PEK',
    board: 'BEIJING',
    services: ['Study'],
    blurb:
      'Study applications from eligibility assessment to online portal submission, with scholarship guidance and a prepared visa file.',
    points: [
      'Eligibility assessment',
      'Scholarship application guidance',
      'Online application portal',
      'Embassy appointment guidance',
    ],
    photo: photo('photo-1547981609-4b6bfe67ca0b'),
  },
]

/**
 * srcset for a hot-linked destination photo. Postcards are shown at most 440px
 * wide, yet each used to download a 1400px original (200-400 KB) — on the
 * mobile data much of this audience uses, the later cards sat blank.
 */
export const photoSrcSet = (url, widths = [480, 720, 960, 1280]) =>
  widths.map((w) => `${url}&w=${w} ${w}w`).join(', ')

export const DESTINATIONS = DESTINATION_LIST.map((d, i) => ({
  ...d,
  index: String(i + 1).padStart(2, '0'),
  kind: kindOf(d.services),
}))

/* ----------------------------------------------------------------------
   Service catalogue — the three lines, verbatim from the client's PDF
   (spelling normalised to the rest of the site)
   ---------------------------------------------------------------------- */

export const CATALOGUE = [
  {
    id: 'student',
    n: '01',
    title: 'Student Visas',
    ask: 'student visas',
    lead: 'We support students throughout the international study application process, from initial eligibility assessment to pre-departure preparation.',
    includes: [
      'University and course selection guidance',
      'Eligibility assessment',
      'University admission application support',
      'Scholarship application guidance',
      'Document preparation and review',
      'Statement of Purpose / Motivation Letter support',
      'CV preparation',
      'Online application portal assistance',
      'Pre-enrollment guidance',
      'CIMEA / DOV guidance where applicable',
      'Embassy appointment and visa-file preparation guidance',
      'Pre-departure travel guidance',
    ],
    destinations: ['Italy', 'Austria', 'Hungary', 'China'],
    note: 'Additional destinations may be available depending on the program, intake and applicant profile.',
  },
  {
    id: 'work',
    n: '02',
    title: 'Work Visas & Permits',
    ask: 'work visas',
    lead: 'We assist eligible applicants with understanding and preparing for employer-sponsored work and work-permit processes.',
    includes: [
      'Work opportunity and eligibility guidance',
      'Employer and document review guidance',
      'Work permit application process guidance',
      'Work visa document preparation support',
      'Application review',
      'Embassy / Visa Application Centre guidance',
      'Appointment assistance where available',
      'Travel and pre-departure preparation',
    ],
    destinations: ['Italy', 'Turkey'],
    note: 'Availability depends on current immigration rules, employer sponsorship and applicant eligibility.',
  },
  {
    id: 'visit',
    n: '03',
    title: 'Visit & Tourist Visas',
    ask: 'visit visas',
    lead: 'Travel for tourism, family visits, business visits, events and holidays with professional application preparation support.',
    includes: [
      'Visa eligibility assessment',
      'Personalised document checklist',
      'Application form guidance and preparation',
      'Invitation-letter guidance where applicable',
      'Accommodation and travel documentation guidance',
      'Flight itinerary guidance',
      'Travel insurance guidance',
      'Financial-document review',
      'Cover letter preparation support',
      'Embassy / VFS appointment guidance',
      'Application file organisation',
      'Travel preparation guidance',
    ],
    destinations: ['Italy / Schengen', 'Ireland', 'Armenia', 'Turkey', 'Canada', 'USA', 'Brazil', 'Mexico'],
    note: 'And other available destinations, subject to requirements and eligibility.',
  },
]

/* From the client's additional-services list. Their list carried both
   "Travel insurance" and a bare "Insurance"; they read as a duplicate on the
   page, so only the first is kept. */
export const EXTRA_SERVICES = [
  'Flight booking',
  'Hotel and accommodation arrangements',
  'Travel itinerary planning',
  'Travel insurance',
  'Document preparation',
  'Pre-departure consultation',
  'Airport and travel guidance',
]

export const WHY = [
  { title: 'Personalised consultation', body: 'Guidance based on your travel, study or work goal.' },
  { title: 'Document support', body: 'Careful review and organisation of the required application documents.' },
  { title: 'Application guidance', body: 'Support through the relevant application stages and procedures.' },
  { title: 'Client-focused service', body: 'Clear communication and professional support throughout the process.' },
  { title: 'Pre-departure support', body: 'Travel preparation and practical guidance before departure.' },
  { title: 'Multiple service areas', body: 'Student, work and visit visa support under one company.' },
]

/* Verbatim from the catalogue. It is the legal counterweight to every
   timing and "no prepayment" line on the site, so it is shown in the
   catalogue section and again in the footer. */
export const NOTICE =
  'Visa approval, admission, scholarships, work permits and immigration decisions are made solely by the relevant institutions and government authorities. Skyline Travel Solution provides professional guidance and application support but cannot guarantee approval or a specific outcome.'

/* The catalogue's six-step service process. */
export const PROCESS = [
  { n: '01', title: 'Consultation', body: 'We start by understanding your goal: study, work or travel.' },
  { n: '02', title: 'Assessment', body: 'Your eligibility for the route is reviewed before anything is prepared.' },
  { n: '03', title: 'Preparation', body: 'Documents are gathered, reviewed and organised into a complete file.' },
  { n: '04', title: 'Application', body: 'The application is prepared and submitted, as applicable.' },
  { n: '05', title: 'Visa process', body: 'We follow the relevant embassy or VFS procedure with you.' },
  { n: '06', title: 'Departure', body: 'Travel preparation and practical guidance before you fly.' },
]

/* Rows of the arrivals board that closes the story. */
export const STATS = [
  { value: 500, suffix: '+', label: 'Visas issued', status: 'And counting' },
  { value: DESTINATIONS.length, suffix: '', label: 'Live destinations', status: 'Open now' },
  { value: CATALOGUE.length, suffix: '', label: 'Service lines', status: 'Study · work · visit' },
  { value: 0, suffix: ' birr', label: 'Payable before approval', status: 'Pay on approval' },
]

export const SCHOLARSHIP = {
  school: 'Post University',
  location: 'Connecticut, USA',
  founded: 'Est. 1890',
  intake: 'Open intake — Fall 2026',
  tiers: [
    { gpa: '3.8+', award: '$25,000' },
    { gpa: '3.5+', award: '$22,500' },
    { gpa: '3.0+', award: '$20,000' },
    { gpa: '2.5+', award: '$15,000' },
    { gpa: '2.0+', award: '$10,000' },
  ],
  programs: [
    { level: 'Undergraduate', fee: '$35,736', after: '$8,850 – $10,640 / yr' },
    { level: 'MBA', fee: '$13,140', after: '$2,500 scholarship' },
    { level: 'MS — Business Intelligence', fee: '$12,400', after: '$2,500 scholarship' },
    { level: 'MS — Computer Science', fee: '$11,350', after: '$2,500 scholarship' },
  ],
}

export const ROLES = [
  {
    title: 'Application Agent',
    type: 'On-site / Full time',
    body: 'Experience with Italy and Austria files required. Other destinations a strong plus.',
  },
  {
    title: 'Customer Service Representative',
    type: 'On-site / Negotiable salary',
    body: 'Any education level. Must be ready to start immediately and make every client experience memorable.',
  },
]

export const NAV = [
  { label: 'Destinations', href: '#destinations' },
  { label: 'Services', href: '#services' },
  { label: 'Process', href: '#process' },
  { label: 'Study', href: '#study' },
  { label: 'Careers', href: '#careers' },
  { label: 'Contact', href: '#contact' },
]
