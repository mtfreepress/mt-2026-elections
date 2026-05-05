const fs = require('fs')
const glob = require('glob')
const YAML = require('yaml')

const urlize = str => str.toLowerCase().replaceAll(/\s/g, '-')

const getMD = path => ({ content: fs.readFileSync(path, 'utf8') })
const getJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'))
const getYml = (path) => YAML.parse(fs.readFileSync(path, 'utf8'))
const collectYmls = (glob_path) => glob.sync(glob_path).map(getYml)

const writeJson = (path, data) => {
    fs.writeFile(path, JSON.stringify(data, null, 2), err => {
        if (err) throw err
        console.log('JSON written to', path)
    }
    );
}

const races = getYml('./inputs/content/races.yml')
const text = getYml('./inputs/content/text.yml')

// Load manual exclusions — candidates to hide from the site without editing
// source data. See inputs/content/excluded-candidates.yml for usage notes.
const excludedCandidates = getYml('./inputs/content/excluded-candidates.yml')
const excludedSlugs = new Set((excludedCandidates.excluded || []).map(e => e.slug))
if (excludedSlugs.size > 0) {
    console.log(`Excluding ${excludedSlugs.size} candidate(s):`, [...excludedSlugs].join(', '))
    // Remove excluded slugs from every race's candidate list so they
    // won't appear in opponents listings or active counts.
    races.forEach(race => {
        if (Array.isArray(race.candidates)) {
            race.candidates = race.candidates.filter(s => !excludedSlugs.has(s))
        }
    })
}

// Only load YAMLs for candidates actually referenced in races.yml.
// Legislative candidates have their own pipeline (process/legislative-candidates.js).
const raceCandidateSlugs = new Set(races.flatMap(r => r.candidates || []))
const DISPLAY_NAME_BY_SLUG_OVERRIDE = {
    'patrick-mccracken': 'Patrick McCracken',
}
const LAST_NAME_BY_SLUG_OVERRIDE = {
    'Mccracken': 'McCracken',
}
// Allows for easier tags in articles and automated processing of candidate names
const SLUG_ALIASES = {
    'brian-j-miller': ['brian-miller'],
    'al-doc-olszewski': ['al-olszewski'],
    'michael-d-eisenhauer': ['michael-eisenhauer'],
}

// Normalize party codes so the site components can consistently bucket parties
const normalizeParty = (p) => {
    if (p === null || p === undefined) return p
    const up = String(p).trim().toUpperCase()
    if (['IND', 'INDEPENDENT', 'I'].includes(up)) return 'I'
    if (['NON', 'NP', 'NONPARTISAN', 'NONE', 'N'].includes(up)) return 'NP'
    if (['REP', 'GOP', 'R'].includes(up)) return 'R'
    if (['DEM', 'D'].includes(up)) return 'D'
    if (['LIB', 'L', 'LP'].includes(up)) return 'L'
    if (['G', 'GRN'].includes(up)) return 'G'
    return up
}

const candidates = collectYmls('./inputs/content/candidates/*.yml')
    .filter(c => raceCandidateSlugs.has(c.slug))
    .map(c => ({
        ...c,
        displayName: DISPLAY_NAME_BY_SLUG_OVERRIDE[c.slug] || c.displayName,
        lastName: LAST_NAME_BY_SLUG_OVERRIDE[c.lastName] || c.lastName,
        party: normalizeParty(c.party),
    }))
console.log(candidates)
const ballotInitiatives = getYml('./inputs/content/ballot-initiatives.yml')
const coverage = getJson('./inputs/coverage/articles.json')
const howToVoteContent = getMD('./inputs/content/how-to-vote.md')
const federalCampaignFinance = getJson('./inputs/fec/finance.json')
// TODO: Update for 2026 cycle
const primaryResults = getJson('./inputs/results/cleaned/2024-primary-statewide.json')


// const questionnaires = getJson('./inputs/mtfp-questionnaire/dummy-answers.json')
const questionnaires = getYml('./inputs/mtfp-questionnaire/copy-edited-answers.yml')

const FEC_DATA_EXCLUDE = [
    // Pre-ballot printing dropouts
    'MYGLAND, JEREMY',
    'MORAN, CORY',
    'ROSENDALE, MATT MR.',
]

// Explicit FEC-ID overrides for known edge cases where IDs are stale or not set
// in candidate YAML files.
const FEC_CANDIDATE_ID_TO_SLUG_OVERRIDE = {
    S6MT00238: 'reilly-neill',
    H2MT02084: 'al-doc-olszewski',
    H0MT00116: 'matt-rains',
    H6MT02226: 'jonathan-windy-boy',
    S6MT00279: 'kate-mclaughlin',
}

// Known FEC records that are not currently active site candidates.
const FEC_UNMATCHED_OK = new Set([
    'H6MT02226', // Jonathan Windy Boy is intentionally excluded
    'S6MT00279', // Kate McLaughlin is not in active race list
])

const FIRST_NAME_ALIASES = {
    al: ['albert'],
    albert: ['al'],
    matt: ['matthew'],
    matthew: ['matt'],
    mike: ['michael'],
    michael: ['mike'],
    jon: ['jonathan'],
    jonathan: ['jon'],
    chris: ['christopher'],
    christopher: ['chris'],
    tom: ['thomas'],
    thomas: ['tom'],
}

const normalizeNameForMatching = (name) => {
    if (!name) return ''

    const raw = String(name).toLowerCase().trim()
    const reordered = raw.includes(',')
        ? `${raw.split(',').slice(1).join(' ')} ${raw.split(',')[0]}`
        : raw

    return reordered
        .replace(/-/g, ' ')
        .replace(/[.'"]/g, ' ')
        .replace(/\b(jr|sr|mr|mrs|ms|dr|ii|iii|iv)\b/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const getNameMatchKeysForCandidate = (candidate) => {
    const keys = new Set()
    const displayNameKey = normalizeNameForMatching(candidate.displayName)
    if (displayNameKey) keys.add(displayNameKey)

    const tokens = displayNameKey.split(' ').filter(Boolean)
    const first = tokens[0]
    const last = normalizeNameForMatching(candidate.lastName || tokens[tokens.length - 1])

    if (first && last) {
        keys.add(`${first} ${last}`)
        ;(FIRST_NAME_ALIASES[first] || []).forEach(alias => keys.add(`${alias} ${last}`))
    }

    return [...keys]
}

// Sort coverage array once rather than on every candidate iteration (avoids repeated mutation)
const sortedCoverage = [...coverage].sort((a, b) => new Date(b.date) - new Date(a.date))

// Build lookup maps to replace O(n) .find() calls inside loops
const candidatesBySlug = new Map(candidates.map(c => [c.slug, c]))
const candidatesByFecId = new Map(candidates.filter(c => c.fecId).map(c => [c.fecId, c]))

const candidatesByNameKey = new Map()
candidates.forEach(candidate => {
    getNameMatchKeysForCandidate(candidate).forEach(key => {
        const existing = candidatesByNameKey.get(key)
        if (!existing) {
            candidatesByNameKey.set(key, candidate)
            return
        }

        if (existing.slug !== candidate.slug) {
            candidatesByNameKey.set(key, null)
        }
    })
})

const matchCandidateForFecRow = (fecData, race) => {
    const raceCandidateSlugs = new Set(race.candidates || [])

    const matchFromOverride = FEC_CANDIDATE_ID_TO_SLUG_OVERRIDE[fecData.candidate_id]
    if (matchFromOverride) {
        const candidate = candidatesBySlug.get(matchFromOverride)
        if (candidate && raceCandidateSlugs.has(candidate.slug)) {
            return { candidate, matchType: 'override-id' }
        }
    }

    const byFecId = candidatesByFecId.get(fecData.candidate_id)
    if (byFecId && raceCandidateSlugs.has(byFecId.slug)) {
        return { candidate: byFecId, matchType: 'fec-id' }
    }

    const normalizedName = normalizeNameForMatching(fecData.candidate_name)
    const byName = candidatesByNameKey.get(normalizedName)
    if (byName && raceCandidateSlugs.has(byName.slug)) {
        return { candidate: byName, matchType: 'name' }
    }

    const nameTokens = normalizedName.split(' ').filter(Boolean)
    if (nameTokens.length >= 2) {
        const first = nameTokens[0]
        const last = nameTokens[nameTokens.length - 1]
        const key = `${first} ${last}`
        const byFirstLast = candidatesByNameKey.get(key)
        if (byFirstLast && raceCandidateSlugs.has(byFirstLast.slug)) {
            return { candidate: byFirstLast, matchType: 'name-first-last' }
        }

        for (const alias of FIRST_NAME_ALIASES[first] || []) {
            const byAlias = candidatesByNameKey.get(`${alias} ${last}`)
            if (byAlias && raceCandidateSlugs.has(byAlias.slug)) {
                return { candidate: byAlias, matchType: 'name-alias' }
            }
        }
    }

    return { candidate: null, matchType: null }
}

// Clean campaign finance data

races.forEach(race => {
    if (race.candidates === null) race.candidates = [] // fallback for unpopulated races

    if (race.campaignFinanceAgency === 'fec') {
        const raceFinance = federalCampaignFinance.find(d => d.raceSlug === race.raceSlug)
        const financeResults = raceFinance && raceFinance.finances && Array.isArray(raceFinance.finances.results)
            ? raceFinance.finances.results
            : []

        if (!raceFinance) {
            console.warn(`Missing FEC finance data for race ${race.raceSlug}`)
        }

        race.finance = financeResults
            .filter(c => !FEC_DATA_EXCLUDE.includes(c.candidate_name))
            .map(fecData => {
                const { candidate: candidateMatch, matchType } = matchCandidateForFecRow(fecData, race)
                if (!candidateMatch) {
                    if (!FEC_UNMATCHED_OK.has(fecData.candidate_id)) {
                        console.warn(`Missing candidate match for ${fecData.candidate_name} (${fecData.candidate_id}) — skipping`)
                    }
                    return null
                }

                return {
                    displayName: candidateMatch.displayName,
                    candidateSlug: candidateMatch.slug,
                    party: candidateMatch.party,
                    matchType,
                    candidateCommitteeName: fecData.candidate_pcc_name,
                    candidateId: fecData.candidate_id,
                    totalReceipts: fecData.total_receipts,
                    totalDisbursments: fecData.total_disbursements,
                    cashOnHand: fecData.cash_on_hand_end_period,
                    coverageEndDate: fecData.coverage_end_date,
                }
            })
            .filter(Boolean)
    } else {
        race.finance = null // Skipping campaign finance integration for non-FEC (i.e. MT COPP races)
    }
})

candidates.forEach(candidate => {
    // merge in necessary race information
    const race = races.find(r => r.candidates.includes(candidate.slug))
    if (!race) console.error('-- No race for candidate', candidate.slug)
    candidate.raceSlug = race.raceSlug
    candidate.raceDisplayName = race.displayName

    // Merge in information about active candidates in race
    // Including current candidate to keep "opponents" menus consistent within races
    candidate.opponents = race.candidates
        // .filter(candidateSlug => candidateSlug !== candidate.slug) // exclude this candidate
        // Skipping exclude to do 'contenders' v. 'opponents'
        .map(candidateSlug => {
            const match = candidatesBySlug.get(candidateSlug)
            if (!match) console.log('No candidateSlug match for', candidateSlug)
            return match
        })
        .filter(c => c && c.status === 'active')
        .map(c => {
            return {// include only fields necessary for opponent listings on candidate pages
                slug: c.slug,
                displayName: c.displayName,
                summaryLine: c.summaryLine,
                party: c.party,
            }
        })

    // merge in MTFP coverage data
    const coverageSlugs = new Set([candidate.slug, ...(SLUG_ALIASES[candidate.slug] || [])])
    candidate.coverage = sortedCoverage
        .filter(article => article.tags.some(t => coverageSlugs.has(urlize(t))))


    // merge in campaign finance data 
    // currently for federal candidates only
    if (race.finance) {
        candidate.finance = race.finance.map(competitor => {
            const match = candidatesBySlug.get(competitor.candidateSlug)
            return {
                ...competitor,
                isThisCandidate: competitor.candidateSlug === candidate.slug,
                candidateStatus: match ? match.status : null
            }
        })
    } else {
        candidate.finance = null
    }


    // merge in questionnaire responses
    const questionnaireMatch = questionnaires.find(d => d.nameSlug === candidate.slug)
    if (!questionnaireMatch) console.log(`${candidate.slug} missing questionnaire answers`)
    candidate.questionnaire = {
        hasResponses: !!(questionnaireMatch && questionnaireMatch.questionnaireMaterial[0].response !== null),
        responses: (questionnaireMatch && questionnaireMatch.questionnaireMaterial !== null) ?
            questionnaireMatch.questionnaireMaterial.map(d => ({ question: d.question, answer: d.response }))
            : []
    }

    // merge in primary election results
    candidate.primaryResults = {
        race: race.raceSlug,
        raceDisplayName: race.displayName,
        party: candidate.party,
        resultsTotal: null, // fallback
        ...primaryResults.find(d => d.race === race.raceSlug && d.party === candidate.party)
    }
})

const overviewRaces = races.map(race => {

    const candidatesInRace = race.candidates.map(candidateSlug => candidates.find(c => c.slug === candidateSlug))
    const activeCandidatesInRace = candidatesInRace.filter(d => d && d.status === 'active')
    const inactiveCandidatesInRace = candidatesInRace.filter(d => d && d.status !== 'active')
    const filterToSummaryFields = c => ({
        // Include only fields necessary for summary page
        slug: c.slug,
        displayName: c.displayName,
        summaryLine: c.summaryLine,
        party: c.party,
        hasResponses: c.questionnaire.hasResponses,
        numMTFParticles: c.coverage.length,
        raceSlug: c.raceSlug,
    })
    if (!(candidatesInRace.length > 0)) console.error('-- No candidates for race', race.raceSlug)
    return {
        ...race,
        candidates: activeCandidatesInRace.map(filterToSummaryFields),
        inactiveCandidates: inactiveCandidatesInRace.map(filterToSummaryFields),
    }
})

console.log(candidates.length, 'candidates')
console.log(candidates.filter(d => d.questionnaire.hasResponses).length, 'responded to questionnaire')

// Write per-candidate JSON files — each candidate page loads only its own file
// instead of the entire candidates array. This keeps individual page bundles small.
const candidatesDir = './src/data/candidates'
fs.mkdirSync(candidatesDir, { recursive: true })
candidates.forEach(candidate => {
    writeJson(`${candidatesDir}/${candidate.slug}.json`, candidate)
})

// Remove stale per-candidate JSON files for excluded candidates.
// These may have been written in a previous run before the candidate was excluded.
excludedSlugs.forEach(slug => {
    const stalePath = `${candidatesDir}/${slug}.json`
    if (fs.existsSync(stalePath)) {
        fs.unlinkSync(stalePath)
        console.log(`Deleted stale candidate JSON for excluded candidate: ${slug}`)
    }
})

// Write thin index — used by getAllCandidateIds() and the search/overview pipeline.
// Does NOT include opponents, finance, questionnaire responses, or coverage (those
// live in the per-candidate files). This file stays small regardless of how many
// candidates or how long their questionnaire answers are.
const candidatesIndex = candidates.map(c => ({
    slug: c.slug,
    displayName: c.displayName,
    lastName: c.lastName,
    summaryLine: c.summaryLine,
    party: c.party,
    raceSlug: c.raceSlug,
    raceDisplayName: c.raceDisplayName,
    status: c.status,
    isIncumbent: c.isIncumbent,
    hasResponses: c.questionnaire.hasResponses,
    numMTFParticles: c.coverage.length,
}))
writeJson('./src/data/candidates-index.json', candidatesIndex)

writeJson('./src/data/overview-races.json', overviewRaces) // Data for landing page
writeJson('./src/data/ballot-initiatives.json', ballotInitiatives) // Pass through - ballot initiative structured test
writeJson('./src/data/text.json', text) // simple pass through logic for now
writeJson('./src/data/how-to-vote.json', howToVoteContent)
writeJson('./src/data/update-time.json', { updateTime: new Date() })



