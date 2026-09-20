/* The admin's map of the website. One entry per editable part: the sidebar,
   the edit forms and the API calls are all generated from this list, so a new
   editable section is one entry here — plus reading it in data/site.js.

   Field types: text · textarea · number · toggle · select · checks · list ·
   rows · image · file. `help` is shown under the label. */

export const SINGLETONS = [
  {
    key: 'brand',
    label: 'Contact & brand',
    icon: '☎',
    intro: 'The office details used across the whole site — the contact section, the footer, the WhatsApp and Telegram links, and every email the site sends.',
    fields: [
      { name: 'tagline', label: 'Tagline', type: 'text', help: 'Shown large in the footer, and beside the logo.' },
      { name: 'mission', label: 'Mission statement', type: 'textarea' },
      { name: 'address', label: 'Address', type: 'text' },
      { name: 'landmark', label: 'Landmark', type: 'text', help: 'e.g. “In front of Awaris Hotel”.' },
      { name: 'mapsQuery', label: 'Google Maps search', type: 'text', help: 'What “Open in maps” searches for.' },
      { name: 'whatsapp', label: 'WhatsApp number', type: 'text', help: 'As it should be shown, with the country code: +251 921 470 395.' },
      { name: 'telegram', label: 'Telegram username', type: 'text', help: 'Without the @.' },
      { name: 'instagram', label: 'Instagram username', type: 'text', help: 'Without the @.' },
      { name: 'email', label: 'Careers email', type: 'text', help: 'Where the careers section points people who prefer email.' },
      {
        name: 'phones',
        label: 'Office phones',
        type: 'rows',
        columns: [
          { name: 'display', label: 'As shown (011 666 2806)' },
          { name: 'tel', label: 'Dial as (+251116662806) — optional' },
        ],
      },
      { name: 'hours', label: 'Office hours', type: 'list', help: 'One line each.' },
      { name: 'hoursNote', label: 'Note under the hours', type: 'text' },
      { name: 'catalogueUrl', label: 'Service catalogue (PDF)', type: 'file', accept: 'application/pdf', help: 'The PDF the “Download the catalogue” links serve.' },
    ],
  },
  {
    key: 'hero',
    label: 'Hero',
    icon: '✈',
    intro: 'The statement on the first screen. The first line is set at plate size, the second sits under it.',
    fields: [
      { name: 'intro', label: 'Top line', type: 'text' },
      { name: 'title', label: 'Headline', type: 'text' },
      { name: 'subtitle', label: 'Second line', type: 'text' },
    ],
  },
  {
    key: 'scholarship',
    label: 'Study offer',
    icon: '🎓',
    intro: 'The Study section: the school, the intake, the programmes and the merit awards.',
    fields: [
      { name: 'school', label: 'School', type: 'text' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'founded', label: 'Founded', type: 'text', help: 'e.g. “Est. 1890”.' },
      { name: 'intake', label: 'Intake', type: 'text', help: 'Written as “Open intake — Fall 2026”.' },
      {
        name: 'programs',
        label: 'Programmes and tuition',
        type: 'rows',
        columns: [
          { name: 'level', label: 'Programme' },
          { name: 'fee', label: 'Listed fee' },
          { name: 'after', label: 'After scholarship' },
        ],
      },
      {
        name: 'tiers',
        label: 'Merit awards by GPA',
        type: 'rows',
        help: 'Highest GPA first. The chart uses the numbers in the award.',
        columns: [
          { name: 'gpa', label: 'GPA (e.g. 3.8+)' },
          { name: 'award', label: 'Award (e.g. $25,000)' },
        ],
      },
    ],
  },
  {
    key: 'notice',
    label: 'Legal notice',
    icon: '§',
    intro: 'The disclaimer shown at the foot of the service catalogue and again in the footer.',
    fields: [{ name: 'text', label: 'Notice', type: 'textarea' }],
  },
]

const SERVICES = ['Study', 'Work', 'Visit']

export const COLLECTIONS = [
  {
    key: 'destinations',
    label: 'Destinations',
    icon: '◎',
    titleField: 'country',
    subtitle: (d) => [d.city, (d.services || []).join(' · ')].filter(Boolean).join(' — '),
    intro: 'The atlas index and the panel each row opens. Hide a destination to take it off the site without losing it.',
    fields: [
      { name: 'country', label: 'Country (as shown)', type: 'text', required: true, help: 'e.g. “Italy / Schengen”.' },
      { name: 'city', label: 'City in the photo', type: 'text', help: 'The caption — keep it true to the picture.' },
      { name: 'iata', label: 'Airport code', type: 'text', help: 'Three letters, e.g. FCO. Shown in the index as ADD → FCO.' },
      { name: 'board', label: 'City, in the index', type: 'text', help: 'Short form, e.g. ROMA.' },
      { name: 'services', label: 'Services', type: 'checks', options: SERVICES },
      { name: 'blurb', label: 'Short description', type: 'textarea' },
      { name: 'points', label: 'What is included', type: 'list' },
      { name: 'photo', label: 'Photo', type: 'image' },
    ],
  },
  {
    key: 'catalogue',
    label: 'Service lines',
    icon: '▦',
    titleField: 'title',
    intro: 'The three lines of the service catalogue. Each one is a numbered entry with its own list of what is included.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'ask', label: 'WhatsApp wording', type: 'text', help: '“Ask about … on WhatsApp”, e.g. “student visas”.' },
      { name: 'lead', label: 'Introduction', type: 'textarea' },
      { name: 'includes', label: 'Our services include', type: 'list' },
      { name: 'destinations', label: 'Destinations', type: 'list' },
      { name: 'note', label: 'Small print', type: 'text' },
    ],
  },
  {
    key: 'extras',
    label: 'Additional services',
    icon: '+',
    titleField: 'title',
    fields: [{ name: 'title', label: 'Service', type: 'text', required: true }],
  },
  {
    key: 'why',
    label: 'Why Skyline',
    icon: '✓',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Heading', type: 'text', required: true },
      { name: 'body', label: 'Text', type: 'textarea' },
    ],
  },
  {
    key: 'process',
    label: 'Process steps',
    icon: '→',
    titleField: 'title',
    intro: 'The “How it runs” steps. They are numbered in this order.',
    fields: [
      { name: 'title', label: 'Step', type: 'text', required: true },
      { name: 'body', label: 'Text', type: 'textarea' },
    ],
  },
  {
    key: 'stats',
    label: 'Record figures',
    icon: '▤',
    titleField: 'label',
    intro: 'The four figures on the dark plate in the middle of the site. Keep values short.',
    fields: [
      { name: 'label', label: 'Label', type: 'text', required: true },
      { name: 'value', label: 'Value', type: 'text', help: 'A number, or #destinations / #services for a count that updates itself.' },
      { name: 'suffix', label: 'Suffix', type: 'text', help: 'e.g. “+” or “ birr” (with the space).' },
      { name: 'status', label: 'Status', type: 'text' },
    ],
  },
  {
    key: 'roles',
    label: 'Open roles',
    icon: '✦',
    titleField: 'title',
    intro: 'The open roles in the careers section. Applications arrive under Form submissions, with the CV.',
    fields: [
      { name: 'title', label: 'Role', type: 'text', required: true },
      { name: 'type', label: 'Terms', type: 'text', help: 'e.g. “On-site / Full time”.' },
      { name: 'body', label: 'Requirements', type: 'textarea' },
    ],
  },
]

/* the website forms, as the office calls them */
export const FORM_KINDS = {
  enquiry: { label: 'Visa enquiry', plural: 'Visa enquiries' },
  study: { label: 'Study application', plural: 'Study applications' },
  career: { label: 'Job application', plural: 'Job applications' },
}

export const EXTRA_LABELS = {
  destination: 'Destination',
  visa: 'Visa type',
  programme: 'Programme',
  education: 'Education',
  gpa: 'GPA',
  intake: 'Intake',
  role: 'Position',
}
