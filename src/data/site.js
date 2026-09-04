export const BRAND = {
  name: 'Skyline Travel Solution',
  short: 'Skyline',
  tagline: 'Your Journey, Our Priority',
  city: 'Addis Ababa',
  country: 'Ethiopia',
  address: '22 Bole Road, Bihul Building, 9th Floor',
  timezone: 'Africa/Addis_Ababa',
  telegram: 'SKYLINE_TRAVEL_SOLUTION',
  telegramUrl: 'https://t.me/SKYLINE_TRAVEL_SOLUTION',
  instagram: 'skyline.travel.so',
  instagramUrl: 'https://instagram.com/skyline.travel.so',
  email: 'managmentskyline@gmail.com',
  phones: ['+251 921 470 395', '+251 984 975 570', '+251 11 666 2806'],
}

// Great-circle arc endpoints rendered on the hero globe.
export const ORIGIN = { name: 'Addis Ababa', lat: 8.98, lon: 38.76 }

export const DESTINATIONS = [
  {
    id: 'turkey',
    iata: 'IST',
    board: 'ISTANBUL',
    index: '01',
    country: 'Türkiye',
    city: 'Istanbul',
    lat: 41.01,
    lon: 28.98,
    kind: 'Work Visa',
    duration: '45 days',
    note: 'Exclusively for female applicants',
    blurb:
      'A legally protected work placement with high demand for female workers, strong benefits and a route to long-term career growth.',
    points: [
      'Only for female applicants',
      'Pay after visa approval',
      'Legal contract and protection',
      'Limited seats per intake',
    ],
    photo: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=1400&q=80&auto=format&fit=crop',
  },
  {
    id: 'italy',
    iata: 'FCO',
    board: 'ROMA',
    index: '02',
    country: 'Italy',
    city: 'Rome',
    lat: 41.9,
    lon: 12.5,
    kind: 'Work Visa',
    duration: '45 days',
    note: 'Decreto Flussi pathway',
    blurb:
      'Build your future in Italy. Expert guidance from document preparation to departure, with complete support until you fly.',
    points: [
      'Expert visa guidance',
      'Complete support until you fly',
      'Pay after visa approval',
      'Fully transparent process',
    ],
    photo: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1400&q=80&auto=format&fit=crop',
  },
  {
    id: 'schengen',
    iata: 'VIE',
    board: 'WIEN',
    index: '03',
    country: 'Schengen',
    city: 'Rome / Vienna',
    lat: 48.21,
    lon: 16.37,
    kind: 'Visit Visa',
    duration: '60 days',
    note: 'Italy and Austria specialists',
    blurb:
      'Short-stay Schengen visit visas prepared, reviewed and lodged by consultants who submit these files every week.',
    points: ['Full file preparation', 'Appointment booking', 'Interview coaching', 'No prepayment'],
    photo: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1400&q=80&auto=format&fit=crop',
  },
  {
    id: 'japan',
    iata: 'NRT',
    board: 'TOKYO',
    index: '04',
    country: 'Japan',
    city: 'Tokyo',
    lat: 35.68,
    lon: 139.69,
    kind: 'Visitor Visa',
    duration: '20 days',
    note: 'Full package',
    blurb:
      'Our fastest package. Bring a passport and a photograph, and we assemble, translate and submit everything else.',
    points: [
      'Requirements: passport and photo',
      'Itinerary and cover letter written for you',
      'Easy and fast process',
      'No prepayment',
    ],
    photo: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1400&q=80&auto=format&fit=crop',
  },
  {
    id: 'france',
    iata: 'CDG',
    board: 'PARIS',
    index: '05',
    country: 'France',
    city: 'Paris',
    lat: 48.86,
    lon: 2.35,
    kind: 'Freelance Visa',
    duration: '90 days',
    note: 'Blocked-account route',
    blurb:
      'The French freelance and self-employment route, arranged end to end. Funds held in a blocked account, fees settled after the visa.',
    points: ['Blocked account arranged', 'Paid after visa approval', 'Business plan support', 'Within 90 days'],
    photo: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1400&q=80&auto=format&fit=crop',
  },
  {
    id: 'usa',
    iata: 'BDL',
    board: 'HARTFORD',
    index: '06',
    country: 'United States',
    city: 'Connecticut',
    lat: 41.6,
    lon: -72.7,
    kind: 'Study Abroad',
    duration: 'Fall 2026',
    note: 'Post University partnership',
    blurb:
      'Direct admission with scholarships up to $25,000, no application fee and no I-20 fee. Open intake for Fall 2026.',
    points: ['No application fee', 'No I-20 fee', 'SEVIS fee credit', 'Scholarships up to $25,000'],
    photo: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&q=80&auto=format&fit=crop',
  },
]

export const SERVICES = [
  {
    n: '01',
    title: 'Work Visas',
    meta: 'Türkiye / Italy',
    body: 'Legally protected placements with vetted employers. We handle the contract, the dossier and the appointment. You pay once the visa is approved.',
  },
  {
    n: '02',
    title: 'Schengen Visit Visas',
    meta: 'Italy / Austria / Europe',
    body: 'Short-stay applications built the way consulates want to read them: complete, consistent and evidenced. Appointment booking and interview coaching included.',
  },
  {
    n: '03',
    title: 'Study Abroad',
    meta: 'United States',
    body: 'University selection, admission, scholarship negotiation, I-20 issuance and F-1 interview preparation, through to your first day on campus.',
  },
  {
    n: '04',
    title: 'Visitor and Tourist Visas',
    meta: 'Japan / Global',
    body: 'Full visitor packages assembled from a passport and a photo. Itineraries, cover letters, bookings and financial evidence prepared in-house.',
  },
  {
    n: '05',
    title: 'Freelance and Self-Employment',
    meta: 'France',
    body: 'The blocked-account route for independent professionals, arranged end to end: from business plan to bank confirmation to lodgement.',
  },
  {
    n: '06',
    title: 'Ticketing and Departure',
    meta: 'Worldwide',
    body: 'Flights, insurance, airport transfer and pre-departure briefing. The last mile of the journey, handled by the team that started it.',
  },
]

export const PROCESS = [
  {
    n: '01',
    title: 'Consultation',
    body: 'A free sit-down at Bole, or a call on Telegram. We read your profile and tell you which routes are genuinely open to you.',
  },
  {
    n: '02',
    title: 'File Preparation',
    body: 'Documents collected, translated, notarised and assembled into a dossier built to the specific consulate standard.',
  },
  {
    n: '03',
    title: 'Submission and Tracking',
    body: 'Appointment booked, biometrics attended, application lodged. You get a status update at every stage. No silence, no guessing.',
  },
  {
    n: '04',
    title: 'Approval and Departure',
    body: 'Visa collected, fee settled, ticket issued. We brief you before you fly and stay reachable after you land.',
  },
]

export const STATS = [
  { value: 500, suffix: '+', label: 'Successful visas issued' },
  { value: 20, suffix: ' days', label: 'Fastest package turnaround' },
  { value: 6, suffix: '', label: 'Active destination desks' },
  { value: 0, suffix: ' birr', label: 'Payable before approval' },
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
