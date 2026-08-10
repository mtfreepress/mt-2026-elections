const fs = require('fs')
const csv = require('async-csv')
const YAML = require('yaml')
const glob = require('glob')
const { parseWebsite } = require('../inputs/content/generate-candidate-yml')

const writeJson = (path, data) => {
    fs.writeFileSync(path, JSON.stringify(data, null, 2))
    console.log('JSON written to', path)
}

const getCsv = async (path) => {
    const string = fs.readFileSync(path, 'utf-8')
    return csv.parse(string, {
        bom: true,
        columns: true,
        relax_column_count: true,
    })
}

const getYml = (path) => YAML.parse(fs.readFileSync(path, 'utf8'))
const collectYmls = (globPath) => glob.sync(globPath).map(getYml)

const urlize = str => str.toLowerCase().replaceAll(/\s/g, '-')

const canonicalizeName = str => (str || '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '')

// --- CONFIGURATION ---

// Name substitutions for candidates who want their name displayed differently
// Key: name as it appears in SoS filing, Value: name to display
const NAME_REPLACE = {
    // e.g. 'FILING NAME': 'PREFERRED DISPLAY NAME',
}

const PARTY_ORDER = ['R', 'D', 'L', 'G', 'I']
// The Secretary of State changes primary winners from FILED to NOMINATED
// after certification. Both values represent candidates who should remain in
// the active input set before it is matched against election results.
const ACTIVE_FILING_STATUSES = new Set(['FILED', 'NOMINATED'])
// Current election cycle year (update for each cycle)
const CYCLE_YEAR = 2026
const OLD_CYCLE_FIELD = 'in_cycle_2024'

// Candidates to manually add (e.g. independents not in SoS CSV)
const MANUAL_ADD_CANDIDATES = [
    // {
    //     'Status': 'FILED',
    //     'Name': 'EXAMPLE NAME',
    //     'District Type': 'House',
    //     'District': 'HOUSE DISTRICT 51',
    //     'Party Preference': 'IND',
    //     'Email/Web Address': '<br />Not Provided',
    // },
]

// Candidates to flag as withdrawn/dropped out
const MANUAL_DROPOUTS = [
    // 'CANDIDATE NAME',
]

// Manual per-candidate field overrides by cleaned display name.
// Useful when SoS filing data is missing/incorrect for a specific field.
const CANDIDATE_FIELD_OVERRIDES = {
    'JAMIE VAN VALKENBURG': {
        campaignWebsite: 'https://jamievv.com',
    },
    'RICHARD GESSLING': {
        campaignWebsite: 'https://richard-gessling-4-montana.com/',
    },
    'CHRIS GRAY': {
        campaignWebsite: 'http://www.cgraymontana.com/',
    },
    'KATE MCLAUGHLIN' : {
        campaignWebsite: 'https://mclaughlinformontana.com/',
    },
    'JANET ELLIS': {
        campaignWebsite: 'https://janetellis4mt.com/',
    },
    'BENJAMIN KUIPER': {
        campaignWebsite: 'https://www.benkuiperforlegislature.com/',
    },
    'JOHN MAXWELL' : {
        campaignWebsite: 'https://www.maxwellforhouse.com/',
    },
    'MEGAN LANE': {
        campaignWebsite: 'https://www.megan4montana.com',
    }
}

const CANDIDATE_FIELD_OVERRIDES_CANONICAL = Object.fromEntries(
    Object.entries(CANDIDATE_FIELD_OVERRIDES).map(([name, overrides]) => [canonicalizeName(name), overrides])
)

// Load manual exclusions shared with the major-race pipeline.
// Excluded legislative candidates are treated as withdrawn so they don't
// appear in opponents lists or active candidate counts.
const excludedCandidatesYml = YAML.parse(fs.readFileSync('./inputs/content/excluded-candidates.yml', 'utf8')) || {}
const EXCLUDED_SLUGS = new Set(((excludedCandidatesYml.excluded || [])).map(e => e.slug))

// --- HELPERS ---

/**
 * Extract campaign website from the "Email/Web Address" CSV field.
 * Format is "email@example.com<br />website.com" or "...<br />Not Provided"
 */
function extractWebsite(emailWebField) {
    return parseWebsite(emailWebField || '') || null
}

/**
 * Clean candidate name: strip incumbent marker (*), trim, apply substitutions
 */
function cleanName(rawName) {
    let name = rawName.trim().replace(/^\*/, '').trim()
    return NAME_REPLACE[name] || name
}

/**
 * Compute whether a district is in the current cycle (CYCLE_YEAR).
 * Houses are every 2 years (always yes). For Senate we invert the
 * provided `in_cycle_2024` value (if present) because senate seats
 * alternate every 4 years.
 */
function computeInCycleForYear(d) {
    if (!d) return 'yes'
    if ((d.chamber || '').toLowerCase() === 'house') return 'yes'
    const old = (d[OLD_CYCLE_FIELD] || '').toString().trim().toLowerCase()
    if (old === 'yes') return 'no'
    if (old === 'no') return 'yes'
    // fallback: if there's a holdover senator listed, assume it's a holdover (not in cycle)
    if (d.holdover_senator && d.holdover_senator.trim()) return 'no'
    return 'yes'
}

/**
 * Extract primary winner names from the primary results JSON.
 * This is used to filter candidates to only show primary winners.
 */
function getPrimaryWinnerNames() {
    try {
        const primaryResults = JSON.parse(fs.readFileSync('./inputs/results/cleaned/2026-primary-legislative.json', 'utf8'))
        const winnerNames = new Set()
        
        primaryResults.forEach(result => {
            if (result.resultsTotal && Array.isArray(result.resultsTotal)) {
                result.resultsTotal.forEach(candidate => {
                    if (candidate.isWinner) {
                        // Normalize the name for matching
                        const normalized = candidateNameNormalized(candidate.candidate)
                        winnerNames.add(normalized)
                    }
                })
            }
        })
        
        return winnerNames
    } catch (e) {
        console.warn('Could not read primary results:', e && e.message)
        return new Set() // Return empty set if file doesn't exist
    }
}

/**
 * Normalize candidate name for matching between different sources.
 * Converts to lowercase and removes special characters.
 */
function candidateNameNormalized(name) {
    if (!name) return ''
    return name.toLowerCase().trim()
}

function hasNonEmptyJsonArray(path) {
    try {
        const value = JSON.parse(fs.readFileSync(path, 'utf8'))
        return Array.isArray(value) && value.length > 0
    } catch (_err) {
        return false
    }
}

function keepPreviousOutputs(message) {
    const outputPaths = [
        './src/data/legislative-candidates.json',
        './src/data/legislative-districts.json',
    ]

    console.error(`ERROR: ${message}. Keeping the previous legislative output files.`)
    if (!outputPaths.every(hasNonEmptyJsonArray)) {
        throw new Error(`${message}; no valid previous legislative outputs are available`)
    }
}

// --- MAIN ---

async function main() {
    let candidates = await getCsv('./inputs/filings/CandidateList.csv')
    const legeDistricts = await getCsv('./inputs/legislative-districts/districts.csv')
    const candidateYmls = collectYmls('./inputs/content/candidates/*.yml')

    if (!Array.isArray(candidates) || candidates.length === 0) {
        keepPreviousOutputs('CandidateList.csv contained no candidate rows')
        return
    }
    if (!Array.isArray(legeDistricts) || legeDistricts.length === 0) {
        keepPreviousOutputs('districts.csv contained no legislative districts')
        return
    }

    const ymlBySlug = new Map(candidateYmls.map(c => [c.slug, c]))
    const ymlByName = new Map(candidateYmls
        .filter(c => c.displayName)
        .map(c => [canonicalizeName(c.displayName), c]))

    // Load legislator roster (used to fill holdover senators not up this cycle)
    let roster = []
    try {
        if (fs.existsSync('./inputs/filings/legislator-roster-2025.json')) {
            roster = JSON.parse(fs.readFileSync('./inputs/filings/legislator-roster-2025.json', 'utf8'))
        }
    } catch (e) {
        console.warn('Could not read legislator roster:', e && e.message)
        roster = []
    }
    const rosterMap = {}
    roster.forEach(r => {
        if (!r.district) return
        const key = r.district.replace('HD ', 'HD-').replace('SD ', 'SD-').trim()
        rosterMap[key] = r
    })

    // Add any manually-specified candidates
    candidates = candidates.concat(MANUAL_ADD_CANDIDATES)

    // Clean district data
    legeDistricts.forEach(d => {
        d.districtKey = d.district.replace('HD ', 'HD-').replace('SD ', 'SD-')
    })

    // Filter to legislative candidates, clean, and transform
    const allLegislativeCandidates = candidates
        .filter(d => ACTIVE_FILING_STATUSES.has((d.Status || '').trim().toUpperCase()))
        .filter(d => ['Senate', 'House'].includes(d['District Type']))
        .map(d => {
            const name = cleanName(d.Name)
            const raceSlug = d.District
                .replace('SENATE DISTRICT ', 'SD-')
                .replace('HOUSE DISTRICT ', 'HD-')
            const party = d['Party Preference'][0] // R, D, L, etc.

            let status = 'active'
            if (MANUAL_DROPOUTS.includes(name)) status = 'withdrawn'
            if (EXCLUDED_SLUGS.has(urlize(name))) status = 'withdrawn'

            const candidateSlug = urlize(name)
            const ymlCandidate = ymlBySlug.get(candidateSlug) || ymlByName.get(canonicalizeName(name))
            const isIncumbent = Boolean(ymlCandidate && ymlCandidate.isIncumbent)
            const fieldOverrides = CANDIDATE_FIELD_OVERRIDES_CANONICAL[canonicalizeName(name)] || {}

            return {
                raceSlug,
                raceDisplayName: raceSlug
                    .replace('HD-', 'House District ')
                    .replace('SD-', 'Senate District '),
                slug: candidateSlug,
                displayName: name,
                party,
                status,
                isIncumbent,
                campaignWebsite: fieldOverrides.campaignWebsite ?? extractWebsite(d['Email/Web Address']),
            }
        })

    if (allLegislativeCandidates.length === 0) {
        keepPreviousOutputs('CandidateList.csv contained no active FILED or NOMINATED legislative candidates')
        return
    }

    // Filter to only include primary winners
    const primaryWinnerNames = getPrimaryWinnerNames()
    if (primaryWinnerNames.size === 0) {
        keepPreviousOutputs('primary results contained no legislative winners')
        return
    }
    const legislativeCandidates = allLegislativeCandidates.filter(candidate => {
        const normalizedName = candidateNameNormalized(candidate.displayName)
        return primaryWinnerNames.has(normalizedName)
    })

    console.log(`Filtered from ${allLegislativeCandidates.length} to ${legislativeCandidates.length} primary winners`)

    if (legislativeCandidates.length === 0) {
        keepPreviousOutputs('no filing records matched the legislative primary winners')
        return
    }

    // Attach opponents list to each candidate
    const candidateOutput = legislativeCandidates.map(c => ({
        ...c,
        opponents: legislativeCandidates
            .filter(d => d.raceSlug === c.raceSlug && d.status === 'active')
            .sort((a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party))
            .map(d => ({
                slug: d.slug,
                displayName: d.displayName,
                party: d.party,
                isIncumbent: d.isIncumbent,
                campaignWebsite: d.campaignWebsite,
            })),
    }))

    // Build per-district output for the district selector UI
    const districtOutput = legeDistricts.map(district => {
        const matchingCandidates = candidateOutput
            .filter(c => c.raceSlug === district.districtKey)
            .sort((a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party))
            .map(c => ({
                slug: c.slug,
                displayName: c.displayName,
                party: c.party,
                status: c.status,
                isIncumbent: c.isIncumbent,
                campaignWebsite: c.campaignWebsite,
            }))

        // compute whether this district is in the current cycle (e.g., 2026)
        const inCycle = computeInCycleForYear(district)

        // remove the old-cycle field from the output and prefer roster values for holdovers
        const { [OLD_CYCLE_FIELD]: _oldCycle, holdover_senator, holdover_party, holdover_link, ...rest } = district

        let resolvedHoldover = null
        let resolvedParty = null
        let resolvedLink = null

        // Only populate holdover senator info for Senate districts (use roster to fill missing values)
        if ((district.chamber || '').toLowerCase() === 'senate') {
            resolvedHoldover = holdover_senator && holdover_senator.trim() ? holdover_senator : null
            resolvedParty = holdover_party && holdover_party.trim() ? holdover_party : null
            resolvedLink = holdover_link && holdover_link.trim() ? holdover_link : null

            if ((!resolvedHoldover || !resolvedParty || !resolvedLink) && rosterMap[district.districtKey]) {
                const r = rosterMap[district.districtKey]
                if (!resolvedHoldover && r.name) resolvedHoldover = r.name
                if (!resolvedParty && r.party) resolvedParty = r.party
                if (!resolvedLink && r.source) resolvedLink = r.source
            }
        } else {
            // preserve any existing holdover fields for non-senate rows, but avoid filling from roster
            resolvedHoldover = holdover_senator && holdover_senator.trim() ? holdover_senator : null
            resolvedParty = holdover_party && holdover_party.trim() ? holdover_party : null
            resolvedLink = holdover_link && holdover_link.trim() ? holdover_link : null
        }

        return {
            ...rest,
            districtKey: district.districtKey,
            in_cycle_2026: inCycle,
            holdover_senator: resolvedHoldover || null,
            holdover_party: resolvedParty || null,
            holdover_link: resolvedLink || null,
            candidates: matchingCandidates,
        }
    })

    if (districtOutput.length === 0) {
        keepPreviousOutputs('legislative district processing produced no districts')
        return
    }

    console.log(candidateOutput.length, 'legislative candidates')
    writeJson('./src/data/legislative-candidates.json', candidateOutput)
    writeJson('./src/data/legislative-districts.json', districtOutput)
}

main().catch(err => {
    console.error('Legislative candidate processing failed:', err.message)
    process.exit(1)
})
