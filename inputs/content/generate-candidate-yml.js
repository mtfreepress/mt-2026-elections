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

function parseWebsite(emailWeb) {
  const parts = emailWeb.split('<br />')
  if (parts.length < 2) return ''
  const raw = parts[1].trim()
  if (EMPTY_SITE_VALUES.has(raw.toLowerCase())) return ''
  // already has a scheme
  if (raw.toLowerCase().startsWith('http')) return raw.toLowerCase()
  return 'https://' + raw.toLowerCase()
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

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const all = parseCSV(fs.readFileSync(CSV_INPUT, 'utf8'))
  console.log(`Loaded ${all.length} rows from CandidateList.csv`)

  // Only FILED candidates make it into the candidates/ folder.
  // Withdrawn, PENDING PETITION, and REMOVED are excluded.
  const filed = all.filter(c => String(c['Status'] || '').trim().toUpperCase() === 'FILED')
  console.log(`${filed.length} candidates with FILED status\n`)

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
}

main()
