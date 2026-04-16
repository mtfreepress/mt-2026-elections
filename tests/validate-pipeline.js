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

function validateCandidatesIndex() {
    const index = readJson(path.join(SRC_DATA, 'candidates-index.json'))
    if (!index) return

    check(Array.isArray(index), 'candidates-index.json: expected an array at top level')
    if (!check(index.length > 0, 'candidates-index.json: array is empty — no candidates found')) return

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
        warnIf(race.candidates && race.candidates.length > 0, `${label}: no active candidates`)
    })
}

function validateLegislativeCandidates() {
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

    validateFecFinance()
    validateCoverageArticles()
    const index = validateCandidatesIndex()
    validatePerCandidateFiles(index)
    validateOverviewRaces()
    validateLegislativeCandidates()
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
