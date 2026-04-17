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
    .map(c => ({ ...c, party: normalizeParty(c.party) }))
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
    // Independent candidates who don't have candidate pages
    // 'NEILL, REILLY'
]

// Sort coverage array once rather than on every candidate iteration (avoids repeated mutation)
const sortedCoverage = [...coverage].sort((a, b) => new Date(b.date) - new Date(a.date))

// Build lookup maps to replace O(n) .find() calls inside loops
const candidatesBySlug = new Map(candidates.map(c => [c.slug, c]))
const candidatesByFecId = new Map(candidates.filter(c => c.fecId).map(c => [c.fecId, c]))

// Clean campaign finance data

races.forEach(race => {
    if (race.candidates === null) race.candidates = [] // fallback for unpopulated races

    if (race.campaignFinanceAgency === 'fec') {
        race.finance = federalCampaignFinance.find(d => d.raceSlug == race.raceSlug).finances.results
            .filter(c => !FEC_DATA_EXCLUDE.includes(c.candidate_name))
            .map(fecData => {
                const candidateMatch = candidatesByFecId.get(fecData.candidate_id)
                if (!candidateMatch) {
                    console.warn(`Missing FEC ID match for ${fecData.candidate_name} (${fecData.candidate_id}) — skipping`)
                    return null
                }
                return {
                    displayName: candidateMatch.displayName,
                    party: candidateMatch.party,
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
    candidate.coverage = sortedCoverage
        .filter(article => article.tags.some(t => urlize(t) === candidate.slug))


    // merge in campaign finance data 
    // currently for federal candidates only
    if (race.finance) {
        candidate.finance = race.finance.map(competitor => {
            const match = candidatesByFecId.get(competitor.candidateId)
            return {
                ...competitor,
                isThisCandidate: (competitor.displayName === candidate.displayName),
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



