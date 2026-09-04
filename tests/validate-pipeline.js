/**
 * Pipeline data validation
 *
 * Runs after the data pipeline scripts to catch common data problems before
 * they reach the build or the live site. Exits with code 1 (and prints all
 * failures) so the calling shell script can abort cleanly.
 *
 * Usage:
 *   node tests/validate-pipeline.js
 */

'use strict'

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const {
    GENERAL_CANDIDATE_LIST,
    PRIMARY_CANDIDATE_LIST,
    isActiveCandidate,
    isWriteInCandidate,
    readCandidateCsv,
} = require('../inputs/filings/candidate-lists')

const ROOT = path.join(__dirname, '..')
const SRC_DATA = path.join(ROOT, 'src/data')
const INPUTS = path.join(ROOT, 'inputs')

// Tiny assertion helpers — collect all failures before exiting so the output
// is actionable rather than stopping at the first problem.

const errors = []
const warnings = []

function fail(message) {
    errors.push(message)
}

function warn(message) {
    warnings.push(message)
}

/** Assert condition is truthy; record an error message otherwise. */
function check(condition, message) {
    if (!condition) fail(message)
    return !!condition
}

/** Assert condition is truthy; record a warning (non-fatal) otherwise. */
function warnIf(condition, message) {
    if (!condition) warn(message)
}

function isValidHttpWebsite(value) {
    try {
        const parsed = new URL(value)
        const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
        return isHttp && parsed.hostname.includes('.') && !/\s/.test(parsed.hostname)
    } catch (_err) {
        return false
    }
}

function filingNameToSlug(name) {
    return String(name || '')
        .replace(/^\*/, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
}

// I/O helpers

function readJson(filePath, required = true) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8')
        if (!raw.trim()) {
            fail(`${path.relative(ROOT, filePath)}: file is empty`)
            return null
        }
        return JSON.parse(raw)
    } catch (e) {
        const rel = path.relative(ROOT, filePath)
        if (required) {
            fail(`${rel}: could not read/parse — ${e.message}`)
        } else {
            warn(`${rel}: optional file missing or unparseable — ${e.message}`)
        }
        return null
    }
}

// Validations

function validateCandidateFilingLists() {
    let primary = []
    let general = []

    try {
        primary = readCandidateCsv(PRIMARY_CANDIDATE_LIST)
        general = readCandidateCsv(GENERAL_CANDIDATE_LIST)
    } catch (e) {
        fail(`candidate filing lists: could not read/parse — ${e.message}`)
        return general
    }

    check(primary.length > 0, 'PrimaryCandidateList.csv: no candidate rows')
    check(general.length > 0, 'GeneralCandidateList.csv: no candidate rows')

    const house22 = general.filter(row => row.District === 'HOUSE DISTRICT 22')
    check(house22.length > 0, 'GeneralCandidateList.csv: House District 22 is missing')
    check(
        house22.some(row => isActiveCandidate(row)),
        'GeneralCandidateList.csv: House District 22 has no active candidates'
    )
    check(
        house22.some(row => ['WITHDRAWN', 'REMOVED'].includes(String(row.Status || '').trim().toUpperCase())),
        'GeneralCandidateList.csv: House District 22 is missing its withdrawn candidate record'
    )

    return general
}

function validateFecFinance() {
    const finance = readJson(path.join(INPUTS, 'fec/finance.json'))
    if (!finance) return

    check(Array.isArray(finance), 'fec/finance.json: expected an array at top level')
    check(finance.length >= 3, `fec/finance.json: expected at least 3 races, got ${finance.length}`)

    const EXPECTED_RACES = ['us-senate', 'us-house-1', 'us-house-2']
    EXPECTED_RACES.forEach(slug => {
        const race = finance.find(r => r.raceSlug === slug)
        if (!check(race, `fec/finance.json: missing expected race "${slug}"`)) return

        check(
            race.finances && Array.isArray(race.finances.results),
            `fec/finance.json [${slug}]: finances.results should be an array`
        )
        warnIf(
            race.finances && race.finances.results && race.finances.results.length > 0,
            `fec/finance.json [${slug}]: finances.results is empty — FEC returned no data`
        )
    })

    const senate = finance.find(race => race.raceSlug === 'us-senate')
    const jamiWoodman = senate?.finances?.results?.find(row =>
        String(row.candidate_name || '').toUpperCase().includes('WOODMAN')
    )
    check(jamiWoodman, 'fec/finance.json [us-senate]: missing explicit Jami Woodman entry')
    if (jamiWoodman) {
        check(
            jamiWoodman.coverage_end_date === null,
            'fec/finance.json [Jami Woodman]: expected no FEC filing coverage date'
        )
        check(
            jamiWoodman.manually_added_no_fec_record === true,
            'fec/finance.json [Jami Woodman]: expected manually_added_no_fec_record=true'
        )
    }
}

function validateCoverageArticles() {
    const articles = readJson(path.join(INPUTS, 'coverage/articles.json'))
    if (!articles) return

    check(Array.isArray(articles), 'coverage/articles.json: expected an array at top level')
    // Early in a cycle there genuinely may be zero articles, so this is a
    // warning rather than an error.
    warnIf(articles.length > 0, 'coverage/articles.json: array is empty — no MTFP articles found')

    if (articles.length > 0) {
        const REQUIRED = ['title', 'date', 'link', 'tags', 'author']
        REQUIRED.forEach(field => {
            const bad = articles.filter(a => !a[field])
            warnIf(
                bad.length === 0,
                `coverage/articles.json: ${bad.length} article(s) missing required field "${field}"`
            )
        })
        // Sanity check: tags should be an array so the processing scripts can
        // filter by tag slug.
        const nonArrayTags = articles.filter(a => !Array.isArray(a.tags))
        check(
            nonArrayTags.length === 0,
            `coverage/articles.json: ${nonArrayTags.length} article(s) have a non-array "tags" field`
        )
    }
}

function validateCandidateInputWebsites() {
    const candidatesDir = path.join(INPUTS, 'content/candidates')
    const files = fs.readdirSync(candidatesDir).filter(file => file.endsWith('.yml'))

    files.forEach(file => {
        const candidate = YAML.parse(fs.readFileSync(path.join(candidatesDir, file), 'utf8'))
        const website = candidate && candidate.campaignWebsite
        if (!website) return

        check(
            isValidHttpWebsite(website),
            `content/candidates/${file}: invalid campaignWebsite "${website}"`
        )
    })
}

function validateCandidatesIndex(generalFilings) {
    const index = readJson(path.join(SRC_DATA, 'candidates-index.json'))
    if (!index) return

    check(Array.isArray(index), 'candidates-index.json: expected an array at top level')
    if (!check(index.length > 0, 'candidates-index.json: array is empty — no candidates found')) return

    // Every statewide primary contest produces at least one general-election
    // candidate. This catches status-sync failures where NOMINATED candidates
    // disappear and only candidates without primaries remain.
    const primaryResults = readJson(path.join(INPUTS, 'results/cleaned/2026-primary-statewide.json'))
    if (Array.isArray(primaryResults)) {
        const primaryContestsWithCandidates = primaryResults.filter(result =>
            Array.isArray(result.resultsTotal) && result.resultsTotal.length > 0
        ).length
        check(
            index.length >= primaryContestsWithCandidates,
            `candidates-index.json: only ${index.length} major-race candidate(s), but `
            + `${primaryContestsWithCandidates} statewide primary contests produced nominees`
        )
    }

    const REQUIRED = ['slug', 'displayName', 'party', 'raceSlug', 'raceDisplayName', 'status']
    index.forEach(c => {
        REQUIRED.forEach(field => {
            check(
                c[field] !== undefined && c[field] !== null && c[field] !== '',
                `candidates-index.json [${c.slug || '?'}]: missing or blank required field "${field}"`
            )
        })
        // hasResponses and numMTFParticles are needed by make-candidate-list.js
        check(
            typeof c.hasResponses === 'boolean',
            `candidates-index.json [${c.slug}]: "hasResponses" should be boolean, got ${typeof c.hasResponses}`
        )
        check(
            typeof c.numMTFParticles === 'number',
            `candidates-index.json [${c.slug}]: "numMTFParticles" should be number, got ${typeof c.numMTFParticles}`
        )
    })

    // Slugs must be unique
    const slugs = index.map(c => c.slug)
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    check(dupes.length === 0, `candidates-index.json: duplicate slug(s): ${dupes.join(', ')}`)

    const majorRaceTypes = new Set(['Statewide', 'Congressional', 'Public Service Commission', 'Supreme Court Justice'])
    const generalWriteIns = generalFilings
        .filter(isActiveCandidate)
        .filter(candidate => majorRaceTypes.has(candidate['District Type']))
        .filter(isWriteInCandidate)
    generalWriteIns.forEach(candidate => {
        const slug = filingNameToSlug(candidate.Name)
        const output = index.find(row => row.slug === slug)
        check(output, `candidates-index.json: active general-election write-in "${candidate.Name}" is missing`)
        if (output) {
            check(output.isWriteIn === true, `candidates-index.json [${slug}]: expected isWriteIn=true`)
        }
    })

    return index
}

function validatePerCandidateFiles(index) {
    const dir = path.join(SRC_DATA, 'candidates')
    if (!check(fs.existsSync(dir), `src/data/candidates/: directory missing — run process/main.js first`)) return

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    check(
        files.length === (index ? index.length : files.length),
        `src/data/candidates/: ${files.length} file(s) but candidates-index.json has ${index ? index.length : '?'} entries`
    )

    const REQUIRED = ['slug', 'displayName', 'party', 'raceSlug', 'raceDisplayName', 'status', 'opponents', 'coverage', 'questionnaire']
    files.forEach(file => {
        const candidate = readJson(path.join(dir, file))
        if (!candidate) return

        REQUIRED.forEach(field => {
            check(
                candidate[field] !== undefined,
                `candidates/${file}: missing field "${field}"`
            )
        })
        check(Array.isArray(candidate.opponents), `candidates/${file}: "opponents" should be an array`)
        check(Array.isArray(candidate.coverage), `candidates/${file}: "coverage" should be an array`)
        check(
            candidate.questionnaire && typeof candidate.questionnaire === 'object',
            `candidates/${file}: "questionnaire" should be an object`
        )
        check(
            candidate.slug === file.replace('.json', ''),
            `candidates/${file}: slug "${candidate.slug}" does not match filename`
        )
    })
}

function validateOverviewRaces() {
    const races = readJson(path.join(SRC_DATA, 'overview-races.json'))
    if (!races) return

    check(Array.isArray(races), 'overview-races.json: expected an array at top level')
    if (!check(races.length > 0, 'overview-races.json: no races found')) return

    races.forEach(race => {
        const label = `overview-races.json [${race.raceSlug || '?'}]`
        check(race.raceSlug, `${label}: missing "raceSlug"`)
        check(Array.isArray(race.candidates), `${label}: "candidates" should be an array`)
        check(Array.isArray(race.inactiveCandidates), `${label}: "inactiveCandidates" should be an array`)

        // Post-primary filtering can intentionally leave some races with no
        // candidates if that race has no winner data yet. Only warn when a
        // race has candidate records but zero active candidates.
        const activeCount = (race.candidates || []).length
        const inactiveCount = (race.inactiveCandidates || []).length
        const hasAnyCandidates = (activeCount + inactiveCount) > 0
        if (hasAnyCandidates) {
            warnIf(activeCount > 0, `${label}: no active candidates`)
        }
    })
}

function validateLegislativeCandidates(generalFilings) {
    const candidates = readJson(path.join(SRC_DATA, 'legislative-candidates.json'))
    if (!candidates) return

    check(Array.isArray(candidates), 'legislative-candidates.json: expected an array at top level')
    if (!check(candidates.length > 0, 'legislative-candidates.json: array is empty')) return

    const REQUIRED = ['slug', 'displayName', 'party', 'raceSlug', 'status']
    // Spot-check the first 20 entries (checking every one of 300+ would be slow)
    candidates.slice(0, 20).forEach(c => {
        REQUIRED.forEach(field => {
            check(
                c[field] !== undefined && c[field] !== null,
                `legislative-candidates.json [${c.slug || '?'}]: missing field "${field}"`
            )
        })
        check(Array.isArray(c.opponents), `legislative-candidates.json [${c.slug}]: "opponents" should be an array`)
    })

    // All raceSlug values should follow the HD-N / SD-N pattern
    const badSlugs = candidates.filter(c => !/^[HS]D-\d+$/.test(c.raceSlug))
    check(
        badSlugs.length === 0,
        `legislative-candidates.json: ${badSlugs.length} candidate(s) have unexpected raceSlug format`
        + (badSlugs.length ? ` — first: "${badSlugs[0].raceSlug}"` : '')
    )

    const validParties = new Set(['R', 'D', 'L', 'G', 'I', 'NP'])
    const badParties = candidates.filter(candidate => !validParties.has(candidate.party))
    check(
        badParties.length === 0,
        `legislative-candidates.json: ${badParties.length} candidate(s) have an unsupported party code`
        + (badParties.length ? ` — first: "${badParties[0].party}"` : '')
    )

    candidates.forEach(candidate => {
        if (candidate.campaignWebsite) {
            check(
                isValidHttpWebsite(candidate.campaignWebsite),
                `legislative-candidates.json [${candidate.slug}]: invalid campaignWebsite "${candidate.campaignWebsite}"`
            )
        }
    })

    // House District 22 includes a post-primary withdrawal in the general
    // filing list. Its generated field must exactly match active general rows.
    const expectedHouse22 = generalFilings
        .filter(row => row.District === 'HOUSE DISTRICT 22')
        .filter(isActiveCandidate)
        .map(row => filingNameToSlug(row.Name))
        .sort()
    const actualHouse22 = candidates
        .filter(candidate => candidate.raceSlug === 'HD-22')
        .map(candidate => candidate.slug)
        .sort()
    check(
        JSON.stringify(actualHouse22) === JSON.stringify(expectedHouse22),
        `legislative-candidates.json [HD-22]: expected active general candidates ${expectedHouse22.join(', ')}, got ${actualHouse22.join(', ')}`
    )

    generalFilings
        .filter(row => ['House', 'Senate'].includes(row['District Type']))
        .filter(isActiveCandidate)
        .filter(isWriteInCandidate)
        .forEach(row => {
            const raceSlug = row.District
                .replace('HOUSE DISTRICT ', 'HD-')
                .replace('SENATE DISTRICT ', 'SD-')
            const slug = filingNameToSlug(row.Name)
            const output = candidates.find(candidate => candidate.raceSlug === raceSlug && candidate.slug === slug)
            check(output, `legislative-candidates.json: active write-in "${row.Name}" is missing from ${raceSlug}`)
            if (output) {
                check(output.isWriteIn === true, `legislative-candidates.json [${slug}]: expected isWriteIn=true`)
                check(!output.campaignWebsite, `legislative-candidates.json [${slug}]: WRITE-IN marker became a campaign website`)
            }
        })

    const royHandley = candidates.find(candidate => candidate.slug === 'roy-handley')
    check(royHandley, 'legislative-candidates.json: Roy Handley is missing')
    if (royHandley) {
        check(
            royHandley.campaignWebsite === 'https://royformt.com/',
            `legislative-candidates.json [roy-handley]: unexpected campaignWebsite "${royHandley.campaignWebsite}"`
        )
    }
}

function validateLegislativeDistricts() {
    const districts = readJson(path.join(SRC_DATA, 'legislative-districts.json'))
    if (!districts) return

    check(Array.isArray(districts), 'legislative-districts.json: expected an array at top level')
    // Montana: 100 House + 50 Senate = 150 districts
    check(
        districts.length >= 100,
        `legislative-districts.json: only ${districts.length} districts — expected at least 100`
    )
    districts.slice(0, 10).forEach(d => {
        check(d.districtKey, `legislative-districts.json: district missing "districtKey"`)
        check(Array.isArray(d.candidates), `legislative-districts.json [${d.districtKey}]: "candidates" should be an array`)
        check(
            d.in_cycle_2026 === 'yes' || d.in_cycle_2026 === 'no',
            `legislative-districts.json [${d.districtKey}]: "in_cycle_2026" should be "yes" or "no", got "${d.in_cycle_2026}"`
        )
    })
}

function validateAllCandidateSummary() {
    const summary = readJson(path.join(SRC_DATA, 'all-candidate-summary.json'))
    if (!summary) return

    check(Array.isArray(summary), 'all-candidate-summary.json: expected an array at top level')
    if (!check(summary.length > 0, 'all-candidate-summary.json: array is empty')) return

    const REQUIRED = ['slug', 'displayName', 'party', 'race', 'status', 'path']
    summary.forEach(c => {
        REQUIRED.forEach(field => {
            check(
                c[field] !== undefined && c[field] !== null && c[field] !== '',
                `all-candidate-summary.json [${c.slug || '?'}]: missing or blank required field "${field}"`
            )
        })
    })

    // Slugs must be unique across the combined list
    const slugs = summary.map(c => c.slug)
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    check(dupes.length === 0, `all-candidate-summary.json: duplicate slug(s): ${dupes.join(', ')}`)
}

// Cross-file consistency checks

function validateCrossFileConsistency(index) {
    if (!index) return

    const overviewRaces = readJson(path.join(SRC_DATA, 'overview-races.json'), false)
    if (!overviewRaces) return

    // Every active candidate in the index should appear in overview-races
    const overviewSlugs = new Set(
        overviewRaces.flatMap(r => (r.candidates || []).map(c => c.slug))
    )
    const activeMissing = index
        .filter(c => c.status === 'active')
        .filter(c => !overviewSlugs.has(c.slug))

    warnIf(
        activeMissing.length === 0,
        `${activeMissing.length} active candidate(s) in candidates-index.json are missing from overview-races.json: `
        + activeMissing.map(c => c.slug).join(', ')
    )
}

// Entry point

function main() {
    console.log('Running pipeline validation...\n')

    const generalFilings = validateCandidateFilingLists()
    validateFecFinance()
    validateCoverageArticles()
    validateCandidateInputWebsites()
    const index = validateCandidatesIndex(generalFilings)
    validatePerCandidateFiles(index)
    validateOverviewRaces()
    validateLegislativeCandidates(generalFilings)
    validateLegislativeDistricts()
    validateAllCandidateSummary()
    validateCrossFileConsistency(index)

    if (warnings.length > 0) {
        console.warn(`\n⚠  WARNINGS (${warnings.length}):`)
        warnings.forEach(w => console.warn(`   - ${w}`))
    }

    if (errors.length > 0) {
        console.error(`\n✗  VALIDATION FAILED — ${errors.length} error(s):`)
        errors.forEach(e => console.error(`   - ${e}`))
        process.exit(1)
    }

    const activeCount = index ? index.filter(c => c.status === 'active').length : '?'
    console.log(`\n✓  All checks passed (${activeCount} active major-race candidates)`)
}

main()
