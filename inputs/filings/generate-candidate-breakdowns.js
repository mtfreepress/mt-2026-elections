const fs = require('fs')
const path = require('path')

// paths relative to this script's location
const CSV_INPUT = path.join(__dirname, 'CandidateList.csv')
const LEGE_LIST = path.join(__dirname, 'lege-2025-list.txt')
const OUT_DIR   = path.join(__dirname, 'candidate-breakdown')

// ── CSV parsing ───────────────────────────────────────────────────────────────

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
  // strip UTF-8 BOM if present (common in .NET-generated CSVs)
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

// csv

function escapeCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

function writeCSV(filePath, headers, rows) {
  const headerLine = headers.map(escapeCell).join(',')
  const dataLines  = rows.map(row => headers.map(h => escapeCell(row[h] ?? '')).join(','))
  const content    = [headerLine, ...dataLines].join('\n') + '\n'
  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`  wrote ${rows.length} row(s) → ${path.relative(process.cwd(), filePath)}`)
}

const CANDIDATE_HEADERS = [
  'Status', 'District Type', 'District', 'Race', 'Term Type', 'Term Length',
  'Name', 'Mailing Address', 'Email/Web Address', 'Phone', 'Filing Date',
  'Party Preference', 'Ballot Order'
]

// strip leading asterisk and lowercase for comparison
function normalizeName(name) {
  return name.replace(/^\*/, '').trim().toLowerCase()
}

function hasAsterisk(name) {
  return name.trim().startsWith('*')
}

function raceKey(row) {
  return `${row['District']}||${row['Race']}`
}

function racePartyKey(row) {
  return `${row['District']}||${row['Race']}||${row['Party Preference']}`
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  // load candidates
  const candidates = parseCSV(fs.readFileSync(CSV_INPUT, 'utf8'))
  console.log(`Loaded ${candidates.length} candidates from CandidateList.csv`)

  // load legislative incumbent list (all lowercase, one name per line)
  const legeNames = new Set(
    fs.readFileSync(LEGE_LIST, 'utf8')
      .replace(/\r/g, '')
      .split('\n')
      .map(l => l.trim().toLowerCase())
      .filter(Boolean)
  )
  console.log(`Loaded ${legeNames.size} names from lege-2025-list.txt`)

  // contested primaries
  console.log('\n── 1. Contested primaries')

  const byRaceParty = {}
  for (const c of candidates) {
    const k = racePartyKey(c)
    if (!byRaceParty[k]) byRaceParty[k] = []
    byRaceParty[k].push(c)
  }

  const contestedPartyKeys = new Set(
    Object.entries(byRaceParty)
      .filter(([, rows]) => rows.length > 1)
      .map(([k]) => k)
  )

  const contestedPrimaryCandidates = candidates.filter(c =>
    contestedPartyKeys.has(racePartyKey(c))
  )

  const contestedPrimarySummary = [...contestedPartyKeys].map(k => {
    const [district, race, party] = k.split('||')
    return { district, race, party, numberOfCandidates: byRaceParty[k].length }
  })

  writeCSV(
    path.join(OUT_DIR, 'contested-primaries-candidates.csv'),
    CANDIDATE_HEADERS,
    contestedPrimaryCandidates
  )
  writeCSV(
    path.join(OUT_DIR, 'contested-primaries.csv'),
    ['district', 'race', 'party', 'numberOfCandidates'],
    contestedPrimarySummary
  )

  console.log('\n── 1b. Uncontested primaries')
  // uncontested primaries
  const uncontestedPrimaryCandidates = candidates.filter(c =>
    !contestedPartyKeys.has(racePartyKey(c))
  )
  const uncontestedPrimaryRacePartyKeys = new Set(
    uncontestedPrimaryCandidates.map(c => racePartyKey(c))
  )
  const uncontestedPrimarySummary = [...uncontestedPrimaryRacePartyKeys].map(k => {
    const [district, race, party] = k.split('||')
    return { district, race, party, numberOfCandidates: byRaceParty[k]?.length ?? 1 }
  })

  writeCSV(
    path.join(OUT_DIR, 'uncontested-primaries-candidates.csv'),
    CANDIDATE_HEADERS,
    uncontestedPrimaryCandidates
  )
  writeCSV(
    path.join(OUT_DIR, 'uncontested-primaries.csv'),
    ['district', 'race', 'party', 'numberOfCandidates'],
    uncontestedPrimarySummary
  )

  // contested generals
  console.log('\n── 2. Contested generals')

  const byRace = {}
  for (const c of candidates) {
    const k = raceKey(c)
    if (!byRace[k]) byRace[k] = []
    byRace[k].push(c)
  }

  const liveGeneralKeys = new Set(
    Object.entries(byRace)
      .filter(([, rows]) => {
        const parties = new Set(rows.map(r => r['Party Preference']))
        return parties.has('REP') && parties.has('DEM')
      })
      .map(([k]) => k)
  )

  const liveGeneralCandidates = candidates.filter(c =>
    liveGeneralKeys.has(raceKey(c))
  )

  const liveGeneralSummary = [...liveGeneralKeys].map(k => {
    const [district, race] = k.split('||')
    return { district, race }
  })

  writeCSV(
    path.join(OUT_DIR, 'contested-general-candidates.csv'),
    CANDIDATE_HEADERS,
    liveGeneralCandidates
  )
  writeCSV(
    path.join(OUT_DIR, 'contested-general.csv'),
    ['district', 'race'],
    liveGeneralSummary
  )

  console.log('\n── 2b. Uncontested generals')
  // uncontested generals
  const uncontestedGeneralCandidates = candidates.filter(c =>
    !liveGeneralKeys.has(raceKey(c))
  )
  const uncontestedGeneralRaceKeys = new Set(
    uncontestedGeneralCandidates.map(c => raceKey(c))
  )
  const uncontestedGeneralSummary = [...uncontestedGeneralRaceKeys].map(k => {
    const [district, race] = k.split('||')
    return { district, race }
  })

  writeCSV(
    path.join(OUT_DIR, 'uncontested-general-candidates.csv'),
    CANDIDATE_HEADERS,
    uncontestedGeneralCandidates
  )
  writeCSV(
    path.join(OUT_DIR, 'uncontested-general.csv'),
    ['district', 'race'],
    uncontestedGeneralSummary
  )

  // incumbents running
  console.log('\n── 3. Incumbents running')

  const incumbentsRunning = candidates.filter(c => hasAsterisk(c['Name']))

  writeCSV(
    path.join(OUT_DIR, 'incumbents-running.csv'),
    CANDIDATE_HEADERS,
    incumbentsRunning
  )

  // incumbents not running + crossover candidates
  const csvByNormalizedName = {}
  for (const c of candidates) {
    const norm = normalizeName(c['Name'])
    if (!csvByNormalizedName[norm]) csvByNormalizedName[norm] = []
    csvByNormalizedName[norm].push(c)
  }

  const incumbentsNotRunning = []
  const crossoverCandidates  = []

  for (const legeName of legeNames) {
    const rows = csvByNormalizedName[legeName]

    if (!rows || rows.length === 0) {
      incumbentsNotRunning.push({ name: legeName })
    } else {
      const hasIncumbentRow = rows.some(r => hasAsterisk(r['Name']))
      if (!hasIncumbentRow) {
        // In the filing list but NOT marked as incumbent → crossover
        crossoverCandidates.push(...rows)
      }
    }
  }

  console.log('\n── 4. Incumbents not running')
  writeCSV(
    path.join(OUT_DIR, 'incumbents-not-running.csv'),
    ['name'],
    incumbentsNotRunning
  )

  console.log('\n── 5. Crossover candidates')
  writeCSV(
    path.join(OUT_DIR, 'crossover-candidates.csv'),
    CANDIDATE_HEADERS,
    crossoverCandidates
  )

  console.log('\nDone.')
}

main()
