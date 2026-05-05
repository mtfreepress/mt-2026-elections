const fs = require('fs')
const csv = require('async-csv')
const YAML = require('yaml')
const glob = require('glob')

const writeJson = (path, data) => {
    fs.writeFile(path, JSON.stringify(data, null, 2), err => {
        if (err) throw err
        console.log('JSON written to', path)
    })
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

// Known host typos to substitute (lowercase keys)
const HOST_REPLACE = {
    'peeformontana.com': 'peteformontana.com',
    'pattisonformontana': 'pattisonformontana.com'
}
const PARTY_ORDER = ['R', 'D', 'L', 'G', 'I']
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
}

// Load manual exclusions shared with the major-race pipeline.
// Excluded legislative candidates are treated as withdrawn so they don't
// appear in opponents lists or active candidate counts.
const excludedCandidatesYml = YAML.parse(fs.readFileSync('./inputs/content/excluded-candidates.yml', 'utf8'))
const EXCLUDED_SLUGS = new Set((excludedCandidatesYml.excluded || []).map(e => e.slug))

// --- HELPERS ---

/**
 * Extract campaign website from the "Email/Web Address" CSV field.
 * Format is "email@example.com<br />website.com" or "...<br />Not Provided"
 */
function extractWebsite(emailWebField) {
    if (!emailWebField) return null
    // Expect format like "email@example.com<br />website.com" or "...<br />Not Provided"
    const parts = emailWebField.split(/<br\s*\/?\>/i)
    if (parts.length < 2) return null
    const websiteRaw = parts[1].trim()
    if (!websiteRaw || websiteRaw.toLowerCase() === 'not provided') return null
    const trimmed = websiteRaw.trim()

    // normalize a host string for matching
    const normalizeHost = (h) => {
        if (!h) return ''
        let host = h.toString().toLowerCase().trim()
        host = host.replace(/^https?:\/\//, '')
        host = host.replace(/^www\./, '')
        host = host.replace(/:\d+$/, '')
        host = host.replace(/\/.*$/, '')
        return host
    }

    const stripToHostname = (s) => s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').replace(/:\d+$/, '').toLowerCase()

    const findReplacement = (host) => {
        const h = normalizeHost(host)
        if (!h) return null
        if (HOST_REPLACE[h]) return HOST_REPLACE[h]
        if (!h.includes('.') && HOST_REPLACE[h + '.com']) return HOST_REPLACE[h + '.com']
        if (h.endsWith('.com')) {
            const withoutCom = h.replace(/\.com$/, '')
            if (HOST_REPLACE[withoutCom]) return HOST_REPLACE[withoutCom]
        }
        // last-resort fuzzy match: ignore dots when comparing
        const noDots = h.replace(/\./g, '')
        for (const key of Object.keys(HOST_REPLACE)) {
            if (key.replace(/\./g, '') === noDots) return HOST_REPLACE[key]
        }
        return null
    }

    // If input includes a protocol, preserve the protocol and path when possible
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const u = new URL(trimmed)
            const hostNoWww = stripToHostname(u.hostname)
            const replacement = findReplacement(hostNoWww)
            if (replacement) {
                const repHost = normalizeHost(replacement)
                u.hostname = repHost
                return u.toString().replace(/\/$/, '')
            }
            u.hostname = hostNoWww
            return u.toString().replace(/\/$/, '')
        } catch (e) {
            const host = normalizeHost(trimmed)
            const replacement = findReplacement(host) || host
            return `https://${replacement}`
        }
    }

    // Bare host (no protocol) — normalize and return https://<host>
    const host = normalizeHost(trimmed)
    const replacement = findReplacement(host) || host
    const finalHost = replacement.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    return `https://${finalHost}`
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

// --- MAIN ---

async function main() {
    let candidates = await getCsv('./inputs/filings/CandidateList.csv')
    const legeDistricts = await getCsv('./inputs/legislative-districts/districts.csv')
    const candidateYmls = collectYmls('./inputs/content/candidates/*.yml')

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
    const legislativeCandidates = candidates
        .filter(d => d.Status === 'FILED')
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
            const fieldOverrides = CANDIDATE_FIELD_OVERRIDES[name] || {}

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

    console.log(candidateOutput.length, 'legislative candidates')
    writeJson('./src/data/legislative-candidates.json', candidateOutput)
    writeJson('./src/data/legislative-districts.json', districtOutput)
}

main()
