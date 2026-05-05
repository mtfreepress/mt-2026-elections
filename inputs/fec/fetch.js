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

const writeJson = (path, data) => {
  fs.writeFile(path, JSON.stringify(data, null, 2), err => {
    if (err) throw err
    console.log('JSON written to', path)
  })
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

const fetchRaceData = async (cycle, office, district) => {
  const url = `https://api.open.fec.gov/v1/elections/?api_key=${FEC_API_KEY}&cycle=${cycle}&election_full=true&office=${office}&state=${ST}&stateFull=${STATE}&district=${district}&per_page=100&sort_hide_null=true`
  console.log(url)

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
      return { raceSlug: race.raceSlug, finances: fetched }
    }

    if (fetched && !hasNonEmptyResults(fetched)) {
      console.warn(`FEC returned empty results for ${race.raceSlug}; preserving last good local data.`)
    }

    if (existingFinance && hasNonEmptyResults(existingFinance)) {
      return { raceSlug: race.raceSlug, finances: existingFinance }
    }

    console.warn(`No fallback data available for ${race.raceSlug}; writing fetched payload as-is.`)
    return {
      raceSlug: race.raceSlug,
      finances: fetched || existingFinance || { api_version: '1.0', pagination: {}, results: [] },
    }
  })

  writeJson(OUT_PATH, combined)
  console.log('FEC fetch done\n')
}

main().catch(err => {
  console.error('FEC fetch error:', err.message)
  process.exit(1)
})
