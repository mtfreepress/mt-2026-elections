// combines major race and legislative candidate lists into single data file for search function
const fs = require('fs')
const getJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'))
const writeJson = (path, data) => {
    fs.writeFile(path, JSON.stringify(data, null, 2), err => {
        if (err) throw err
        console.log('JSON written to', path)
    }
    );
}

// candidates-index.json has the summary fields pre-computed by process/main.js,
// so no heavier per-candidate files need to be loaded here.
const candidatesIndex = getJson('./src/data/candidates-index.json')

const allCandidates = candidatesIndex.map(c => ({
    slug: c.slug,
    path: 'candidates',
    displayName: c.displayName,
    summaryLine: c.summaryLine,
    race: c.raceDisplayName,
    party: c.party,
    status: c.status,
    hasResponses: c.hasResponses,
    numMTFParticles: c.numMTFParticles,
    cap_tracker_2025_link: null,
}))

// Legislative candidates are excluded from name search since they
// don't have individual pages — they're shown via the district selector instead

writeJson('./src/data/all-candidate-summary.json', allCandidates)

