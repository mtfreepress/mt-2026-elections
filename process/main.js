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
// Only load YAMLs for candidates actually referenced in races.yml.
// Legislative candidates have their own pipeline (process/legislative-candidates.js).
const raceCandidateSlugs = new Set(races.flatMap(r => r.candidates || []))
const candidates = collectYmls('./inputs/content/candidates/*.yml')
    .filter(c => raceCandidateSlugs.has(c.slug))
const ballotInitiatives = getYml('./inputs/content/ballot-initiatives.yml')
const coverage = getJson('./inputs/coverage/articles.json')
const howToVoteContent = getMD('./inputs/content/how-to-vote.md')
const federalCampaignFinance = getJson('./inputs/fec/finance.json')
const primaryResults = getJson('./inputs/results/cleaned/2024-primary-statewide.json')


// const questionnaires = getJson('./inputs/mtfp-questionnaire/dummy-answers.json')
const questionnaires = getYml('./inputs/mtfp-questionnaire/copy-edited-answers.yml')

const FEC_DATA_EXCLUDE = [
    // Pre-ballot printing dropouts 
    'MYGLAND, JEREMY',
    'MORAN, CORY',
    'ROSENDALE, MATT MR.',
    // Independent candidates who don't have candidate pages
    'NEILL, REILLY'
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
        hasResponses: (questionnaireMatch && questionnaireMatch.questionnaireMaterial[0].response !== null),
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

writeJson('./src/data/candidates.json', candidates) // Data for candidate pages
writeJson('./src/data/overview-races.json', overviewRaces) // Data for landing page
writeJson('./src/data/ballot-initiatives.json', ballotInitiatives) // Pass through - ballot initiative structured test
writeJson('./src/data/text.json', text) // simple pass through logic for now
writeJson('./src/data/how-to-vote.json', howToVoteContent)
writeJson('./src/data/update-time.json', { updateTime: new Date() })



