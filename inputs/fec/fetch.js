// Pull campaign finance data from FEC API on a by-race basis.
// If an API call fails or returns empty results, keep the last good local data.

const fs = require('fs')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

require('dotenv').config()
// Expects FEC_API_KEY="xxxx" in a .env file at repo root.

const OUT_PATH = './inputs/fec/finance.json'

const { FEC_API_KEY } = process.env

const ST = 'mt'
const STATE = 'Montana'

const RACES = [
  { raceSlug: 'us-senate', office: 'senate', district: '' },
  { raceSlug: 'us-house-1', office: 'house', district: '01' },
  { raceSlug: 'us-house-2', office: 'house', district: '02' },
]

// Candidates known to be on the general-election ballot who do not currently
// have a matching FEC record. Keeping an explicit zero-data row makes it clear
// that the candidate was checked instead of accidentally omitted. If the FEC
// later returns a matching record, that API row takes precedence.
const REQUIRED_ZERO_DATA_CANDIDATES = {
  'us-senate': [
    {
      candidate_name: 'WOODMAN, JAMI DEE',
      candidate_id: null,
      candidate_pcc_name: null,
      total_receipts: 0,
      total_disbursements: 0,
      cash_on_hand_end_period: 0,
      coverage_end_date: null,
      manually_added_no_fec_record: true,
    },
  ],
}

const writeJson = (path, data) => {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
  console.log('JSON written to', path)
}

const readExistingJson = path => {
  if (!fs.existsSync(path)) return null
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  } catch (err) {
    console.warn(`Could not parse existing JSON at ${path}: ${err.message}`)
    return null
  }
}

const hasNonEmptyResults = payload => {
  return !!(payload && Array.isArray(payload.results) && payload.results.length > 0)
}

const normalizeCandidateName = name => {
  const raw = String(name || '').toLowerCase().trim()
  const reordered = raw.includes(',')
    ? `${raw.split(',').slice(1).join(' ')} ${raw.split(',')[0]}`
    : raw

  return reordered
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const candidateNameIdentity = name => {
  const parts = normalizeCandidateName(name).split(' ').filter(Boolean)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || ''
}

const includeRequiredZeroDataCandidates = (raceSlug, finances) => {
  const required = REQUIRED_ZERO_DATA_CANDIDATES[raceSlug] || []
  const results = Array.isArray(finances.results) ? [...finances.results] : []
  const names = new Set(results.map(row => candidateNameIdentity(row.candidate_name)))

  required.forEach(candidate => {
    if (!names.has(candidateNameIdentity(candidate.candidate_name))) {
      results.push(candidate)
    }
  })

  return { ...finances, results }
}

const fetchRaceData = async (cycle, office, district) => {
  const url = `https://api.open.fec.gov/v1/elections/?api_key=${FEC_API_KEY}&cycle=${cycle}&election_full=true&office=${office}&state=${ST}&stateFull=${STATE}&district=${district}&per_page=100&sort_hide_null=true`
  console.log(`Fetching FEC ${office}${district ? ` district ${district}` : ''} data for cycle ${cycle}`)

  const result = await fetch(url)
  if (!result.ok) {
    throw new Error(`FEC request failed (${result.status} ${result.statusText})`)
  }

  return result.json()
}

async function main() {
  const existing = readExistingJson(OUT_PATH) || []
  const existingBySlug = new Map(existing.map(r => [r.raceSlug, r.finances]))

  if (!FEC_API_KEY) {
    console.warn('FEC_API_KEY missing. Keeping existing finance.json data.')
    if (existing.length > 0) {
      console.log('FEC fetch skipped; existing data preserved\n')
      return
    }
    throw new Error('FEC_API_KEY missing and no existing finance.json fallback is available')
  }

  const fetchedBySlug = new Map()

  for (const race of RACES) {
    try {
      const data = await fetchRaceData('2026', race.office, race.district)
      fetchedBySlug.set(race.raceSlug, data)
    } catch (err) {
      console.warn(`FEC fetch failed for ${race.raceSlug}: ${err.message}`)
      fetchedBySlug.set(race.raceSlug, null)
    }
  }

  const combined = RACES.map(race => {
    const fetched = fetchedBySlug.get(race.raceSlug)
    const existingFinance = existingBySlug.get(race.raceSlug)

    if (hasNonEmptyResults(fetched)) {
      return {
        raceSlug: race.raceSlug,
        finances: includeRequiredZeroDataCandidates(race.raceSlug, fetched),
      }
    }

    if (fetched && !hasNonEmptyResults(fetched)) {
      console.error(`ERROR: FEC returned empty results for ${race.raceSlug}; preserving last good local data.`)
    }

    if (existingFinance && hasNonEmptyResults(existingFinance)) {
      return {
        raceSlug: race.raceSlug,
        finances: includeRequiredZeroDataCandidates(race.raceSlug, existingFinance),
      }
    }

    throw new Error(`FEC returned no results for ${race.raceSlug} and no previous data is available`)
  })

  if (combined.length === 0) {
    throw new Error('FEC processing produced no race data; keeping existing finance.json')
  }

  writeJson(OUT_PATH, combined)
  console.log('FEC fetch done\n')
}

main().catch(err => {
  console.error('FEC fetch error:', err.message)
  process.exit(1)
})
