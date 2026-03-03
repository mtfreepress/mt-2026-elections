const fs = require('fs')
const csv = require('async-csv')

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

const urlize = str => str.toLowerCase().replaceAll(/\s/g, '-')

// --- CONFIGURATION ---

// Name substitutions for candidates who want their name displayed differently
// Key: name as it appears in SoS filing, Value: name to display
const NAME_REPLACE = {
    // e.g. 'FILING NAME': 'PREFERRED DISPLAY NAME',
}

const PARTY_ORDER = ['R', 'D', 'L', 'G', 'I']

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

// --- HELPERS ---

/**
 * Extract campaign website from the "Email/Web Address" CSV field.
 * Format is "email@example.com<br />website.com" or "...<br />Not Provided"
 */
function extractWebsite(emailWebField) {
    if (!emailWebField) return null
    const parts = emailWebField.split('<br />')
    if (parts.length < 2) return null
    const website = parts[1].trim()
    if (!website || website.toLowerCase() === 'not provided') return null
    const trimmed = website.trim()
    // If protocol present, remove leading www. after protocol and lowercase
    if (trimmed.match(/^https?:\/\//i)) {
        return trimmed.replace(/^(https?:\/\/)www\./i, '$1').toLowerCase()
    }
    // Otherwise strip a leading www. and prepend https://
    const host = trimmed.replace(/^www\./i, '')
    return `https://${host.toLowerCase()}`
}

/**
 * Clean candidate name: strip incumbent marker (*), trim, apply substitutions
 */
function cleanName(rawName) {
    let name = rawName.trim().replace(/^\*/, '').trim()
    return NAME_REPLACE[name] || name
}

// --- MAIN ---

async function main() {
    let candidates = await getCsv('./inputs/filings/CandidateList.csv')
    const legeDistricts = await getCsv('./inputs/legislative-districts/districts.csv')

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

            return {
                raceSlug,
                raceDisplayName: raceSlug
                    .replace('HD-', 'House District ')
                    .replace('SD-', 'Senate District '),
                slug: urlize(name),
                displayName: name,
                party,
                status,
                campaignWebsite: extractWebsite(d['Email/Web Address']),
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
                campaignWebsite: c.campaignWebsite,
            }))
        return {
            ...district,
            candidates: matchingCandidates,
        }
    })

    console.log(candidateOutput.length, 'legislative candidates')
    writeJson('./src/data/legislative-candidates.json', candidateOutput)
    writeJson('./src/data/legislative-districts.json', districtOutput)
}

main()
