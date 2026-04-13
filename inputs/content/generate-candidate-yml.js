const fs = require('fs')
const path = require('path')

const CSV_INPUT = path.join(__dirname, '..', 'filings', 'CandidateList.csv')
const OUT_DIR   = path.join(__dirname, 'candidates')

function parseCsvRow(line) {
  const cells = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let val = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else val += line[i++]
      }
      cells.push(val)
      if (line[i] === ',') i++
    } else {
      let val = ''
      while (i < line.length && line[i] !== ',') val += line[i++]
      cells.push(val)
      if (line[i] === ',') i++
    }
  }
  return cells
}

function parseCSV(content) {
  content = content.replace(/^\uFEFF/, '')
  const lines = content.replace(/\r/g, '').split('\n').filter(l => l.trim())
  const headers = parseCsvRow(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCsvRow(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
    return obj
  })
}

// strip leading asterisk (marks incumbentship in source data)
function stripAsterisk(name) {
  return name.replace(/^\*/, '').trim()
}

function isIncumbent(name) {
  return name.trim().startsWith('*')
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function nameToSlug(name) {
  return stripAsterisk(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function getLastName(name) {
  const parts = stripAsterisk(name).trim().split(/\s+/)
  return toTitleCase(parts[parts.length - 1])
}

function getDisplayName(name) {
  return toTitleCase(stripAsterisk(name))
}

// website parsing

const EMPTY_SITE_VALUES = new Set(['not provided', 'na', ''])

// Known host typos/omissions to substitute (lowercase keys, no protocol/www/trailing slash)
const HOST_REPLACE = {
  'peeformontana.com': 'peteformontana.com',
  'pattisonformontana': 'pattisonformontana.com',
}

function normalizeHost(raw) {
  return raw.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
}

function applyHostReplace(url) {
  const host = normalizeHost(url)
  if (HOST_REPLACE[host]) return `https://${HOST_REPLACE[host]}`
  // also try without .com suffix in case the raw value has no extension
  const withoutCom = host.replace(/\.com$/, '')
  if (HOST_REPLACE[withoutCom]) return `https://${HOST_REPLACE[withoutCom]}`
  return url
}

function parseWebsite(emailWeb) {
  const parts = emailWeb.split('<br />')
  if (parts.length < 2) return ''
  const raw = parts[1].trim()
  if (EMPTY_SITE_VALUES.has(raw.toLowerCase())) return ''
  // already has a scheme
  const url = raw.toLowerCase().startsWith('http')
    ? raw.toLowerCase()
    : 'https://' + raw.toLowerCase()
  return applyHostReplace(url)
}

// party mapping

const PARTY_MAP = { REP: 'R', DEM: 'D', LIB: 'L', NON: 'NON', IND: 'IND' }

function mapParty(party) {
  return PARTY_MAP[String(party).trim().toUpperCase()] ?? party
}


// keep same format as 2024 guide

function buildYml(candidate) {
  const rawName    = candidate['Name']
  const slug       = nameToSlug(rawName)
  const displayName = getDisplayName(rawName)
  const lastName   = getLastName(rawName)
  const incumbent  = isIncumbent(rawName)
  const party      = mapParty(candidate['Party Preference'])
  const website    = parseWebsite(candidate['Email/Web Address'])

  return `---
slug: ${slug}
displayName: ${displayName}
lastName: ${lastName}
summaryLine:
summaryNarrative:
party: ${party}
isIncumbent: ${incumbent}
status: active
fecId:
## Campaign web links
campaignWebsite: ${website}
campaignFB:
campaignTW:
campaignIG:
campaignYT:
campaignTT:
`
}

// races.yml
const RACES_OUTPUT = path.join(__dirname, 'races.yml')

// District types whose candidates are eligible for races.yml
const RACES_DISTRICT_TYPES = new Set([
  'Statewide',
  'Congressional',
  'Public Service Commission',
  'Supreme Court Justice',
])

// Ordered race definitions.  section comments mirror the 2024 guide.
const RACE_META = [
  {
    section: 'FEDERAL',
    district: 'STATE',
    race: 'UNITED STATES SENATOR',
    raceSlug: 'us-senate',
    displayName: 'U.S. Senate',
    level: 'Federal Delegation',
    campaignFinanceAgency: 'fec',
    category: 'us-senate',
    description: "One of Montana's two U.S. Senate seats, elected with a statewide vote. Elected to a six-year term.",
    note: '',
  },
  {
    section: null,
    district: '1ST CONGRESSIONAL',
    race: 'UNITED STATES REPRESENTATIVE',
    raceSlug: 'us-house-1',
    displayName: 'U.S. House District 1 (West)',
    level: 'Federal Delegation',
    campaignFinanceAgency: 'fec',
    category: 'us-house',
    description: 'Western Montana representative in Congress. District includes Missoula, Bozeman, Kalispell and Butte. Elected to a two-year term.',
    note: '',
  },
  {
    section: null,
    district: '2ND CONGRESSIONAL',
    race: 'UNITED STATES REPRESENTATIVE',
    raceSlug: 'us-house-2',
    displayName: 'U.S. House District 2 (East)',
    level: 'Federal Delegation',
    campaignFinanceAgency: 'fec',
    category: 'us-house',
    description: 'Eastern Montana representative in Congress. District includes Billings, Great Falls, Helena, Havre and Miles City. Elected to a two-year term.',
    note: '',
  },
  {
    section: 'STATE DISTRICT',
    district: 'PUBLIC SERVICE COMMISSIONER DISTRICT 1',
    race: 'PUBLIC SERVICE COMMISSIONER, DISTRICT 1',
    raceSlug: 'psc-1',
    displayName: 'Public Service Commission (Seat 1)',
    level: 'Public Service Commission',
    campaignFinanceAgency: null,
    category: 'psc',
    description: "One of five seats on the state's utility regulation board, elected to a four-year term. The district spans eastern Montana, including Billings and Miles City.",
    note: '',
  },
  {
    section: null,
    district: 'PUBLIC SERVICE COMMISSIONER DISTRICT 5',
    race: 'PUBLIC SERVICE COMMISSIONER, DISTRICT 5',
    raceSlug: 'psc-5',
    displayName: 'Public Service Commission (Seat 5)',
    level: 'Public Service Commission',
    campaignFinanceAgency: null,
    category: 'psc',
    description: "One of five seats on the state's utility regulation board, elected to a four-year term. The district spans western Montana, including Missoula and Kalispell.",
    note: '',
  },
  {
    section: 'MONTANA SUPREME COURT',
    district: 'SUPREME COURT JUSTICE',
    race: 'SUPREME COURT JUSTICE #4',
    raceSlug: 'supco-4',
    displayName: 'State Supreme Court (Seat 4)',
    level: 'Montana Supreme Court',
    campaignFinanceAgency: null,
    category: 'supco-4',
    description: "One of seven seats on the state's high court, which takes appeals from lower courts and administers the Montana legal system. Elected to an eight-year term via a statewide election.",
    note: '',
  },
]

function buildRacesYml(all) {
  const ACTIVE_STATUSES = new Set(['FILED', 'PENDING PETITION'])

  // group active candidates by district|race key
  const byRace = new Map()
  for (const candidate of all) {
    if (!RACES_DISTRICT_TYPES.has(candidate['District Type'])) continue
    const status = String(candidate['Status'] || '').trim().toUpperCase()
    if (!ACTIVE_STATUSES.has(status)) continue
    const key = candidate['District'].trim().toUpperCase() + '|' + candidate['Race'].trim().toUpperCase()
    if (!byRace.has(key)) byRace.set(key, [])
    byRace.get(key).push(nameToSlug(candidate['Name']))
  }

  const lines = ['---']
  let lastSection = null

  for (const meta of RACE_META) {
    if (meta.section && meta.section !== lastSection) {
      lines.push('')
      lines.push(`# ${meta.section}`)
      lastSection = meta.section
    }

    const key = meta.district.toUpperCase() + '|' + meta.race.toUpperCase()
    const slugs = byRace.get(key) || []

    lines.push('')
    lines.push(`- raceSlug: ${meta.raceSlug}`)
    lines.push(`  displayName: ${meta.displayName}`)
    lines.push(`  level: ${meta.level}`)
    if (meta.campaignFinanceAgency) {
      lines.push(`  campaignFinanceAgency: ${meta.campaignFinanceAgency}`)
    }
    lines.push(`  category: ${meta.category}`)
    lines.push(`  description: ${meta.description}`)
    lines.push(`  note: ${meta.note}`)
    lines.push('  candidates:')
    for (const slug of slugs) {
      lines.push(`    - ${slug}`)
    }
  }

  const output = lines.join('\n') + '\n'
  fs.writeFileSync(RACES_OUTPUT, output, 'utf8')
  console.log(`\nWrote races.yml with ${RACE_META.length} race(s).`)
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const all = parseCSV(fs.readFileSync(CSV_INPUT, 'utf8'))
  console.log(`Loaded ${all.length} rows from CandidateList.csv`)

  // FILED and PENDING PETITION candidates make it into the candidates/ folder.
  // Withdrawn and REMOVED are excluded.
  const ACTIVE_STATUSES = new Set(['FILED', 'PENDING PETITION'])
  const filed = all.filter(c => ACTIVE_STATUSES.has(String(c['Status'] || '').trim().toUpperCase()))
  console.log(`${filed.length} active candidates (FILED or PENDING PETITION)\n`)

  const slugsSeen = new Map()
  let written  = 0
  let skipped  = 0

  for (const candidate of filed) {
    const slug     = nameToSlug(candidate['Name'])
    const filename = `${slug}.yml`
    const outPath  = path.join(OUT_DIR, filename)

    // warn about slug collisions so they can be resolved by hand
    if (slugsSeen.has(slug)) {
      console.warn(`  WARNING: slug collision "${slug}" — "${candidate['Name']}" conflicts with "${slugsSeen.get(slug)}"`)
    }
    slugsSeen.set(slug, candidate['Name'])

    // never overwrite a file the user may have already edited by hand
    if (fs.existsSync(outPath)) {
      console.log(`  skip (exists): ${filename}`)
      skipped++
      continue
    }

    fs.writeFileSync(outPath, buildYml(candidate), 'utf8')
    console.log(`  wrote: ${path.relative(process.cwd(), outPath)}`)
    written++
  }

  console.log(`\nDone. ${written} file(s) written, ${skipped} skipped (already existed).`)

  buildRacesYml(all)
}

main()
