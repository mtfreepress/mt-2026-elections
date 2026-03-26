const fs = require('fs')
const path = require('path')

// paths relative to this script's location
const CSV_INPUT      = path.join(__dirname, 'CandidateList.csv')
const CSV_PREV       = path.join(__dirname, 'CandidateList_20240911.csv')
const LEGE_LIST      = path.join(__dirname, 'lege-2025-list.txt')
const OUT_DIR        = path.join(__dirname, 'candidate-breakdown')

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
  'District', 'Race', 'Name', 'Filing Date', 'Party Preference'
]

// strip leading asterisk and lowercase for comparison
function normalizeName(name) {
  return name.replace(/^\*/, '').trim().toLowerCase()
}

function hasAsterisk(name) {
  return name.trim().startsWith('*')
}

// format district numbers to 3 digits for HOUSE output and 2 digits for SENATE
function formatDistrict(district) {
  if (!district) return district
  const s = String(district).trim()
  const mHouse = s.match(/house\s+district\s*(\d+)/i)
  if (mHouse) return `HOUSE DISTRICT ${String(mHouse[1]).padStart(3, '0')}`
  const mSenate = s.match(/senate\s+district\s*(\d+)/i)
  if (mSenate) return `SENATE DISTRICT ${String(mSenate[1]).padStart(2, '0')}`
  return s
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

  // previous cycle candidates to exclude from incumbents-not-running.csv
  const prevCandidates = parseCSV(fs.readFileSync(CSV_PREV, 'utf8'))
  const prevNames = new Set(prevCandidates.map(c => normalizeName(c['Name'])))
  console.log(`Loaded ${prevCandidates.length} candidates from previous election list`)

  console.log('\n── 1. Contested primaries')
  let statusKey = null
  if (candidates.length > 0) {
    const keys = Object.keys(candidates[0])
    statusKey = keys.find(k => k && k.trim().toLowerCase() === 'status')
      || keys.find(k => k && k.trim().toLowerCase() === 'filing status')
      || keys.find(k => k && k.trim().toLowerCase().includes('status'))
  }

  const filedCandidates = statusKey
    ? candidates.filter(c => String((c[statusKey] || '')).trim().toUpperCase() === 'FILED')
    : candidates

  const byRaceParty = {}
  for (const c of filedCandidates) {
    const k = racePartyKey(c)
    if (!byRaceParty[k]) byRaceParty[k] = []
    byRaceParty[k].push(c)
  }

  const contestedPartyKeys = new Set(
    Object.entries(byRaceParty)
      .filter(([, rows]) => rows.length > 1)
      .map(([k]) => k)
  )

  const contestedPrimaryCandidates = filedCandidates.filter(c =>
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

  // Contested Senate / House primaries summary
  const contestedByDistrictType = { senate: {}, house: {} }

  for (const k of contestedPartyKeys) {
    const [district, race, party] = k.split('||')
    const d = (district || '').toUpperCase()
    let type = null
    if (d.includes('SENATE')) type = 'senate'
    else if (d.includes('HOUSE')) type = 'house'
    if (!type) continue

    if (!contestedByDistrictType[type][district]) contestedByDistrictType[type][district] = new Set()
    contestedByDistrictType[type][district].add(party)
  }

  const contestedSenate = Object.entries(contestedByDistrictType.senate).map(([district, partiesSet]) => {
    const parties = Array.from(partiesSet)
    const party = (parties.includes('REP') && parties.includes('DEM')) ? 'BOTH' : parties[0]
    return { district: formatDistrict(district), party }
  })

  const contestedHouse = Object.entries(contestedByDistrictType.house).map(([district, partiesSet]) => {
    const parties = Array.from(partiesSet)
    const party = (parties.includes('REP') && parties.includes('DEM')) ? 'BOTH' : parties[0]
    return { district: formatDistrict(district), party }
  })

  writeCSV(
    path.join(OUT_DIR, 'contested-senate-primaries.csv'),
    ['district', 'party'],
    contestedSenate
  )
  writeCSV(
    path.join(OUT_DIR, 'contested-house-primaries.csv'),
    ['district', 'party'],
    contestedHouse
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
      // skip incumbents who ran in the previous election — they're just not up this cycle
      if (prevNames.has(legeName)) continue
      incumbentsNotRunning.push({ name: legeName })
    } else {
      const hasIncumbentRow = rows.some(r => hasAsterisk(r['Name']))
      if (!hasIncumbentRow) {
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
