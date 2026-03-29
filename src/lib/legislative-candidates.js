// Lazy-loaded so the 200 KB JSON is not bundled unless getCandidateData() is actually called.
// getAllCandidateIds() returns [] for 2026, so individual candidate pages are never generated
// and this module is only referenced via getStaticProps (server-side) — not the client bundle.
let _cache = null
function getLegislativeCandidates() {
    if (!_cache) _cache = require('../data/legislative-candidates.json')
    return _cache
}

export function getAllCandidateIds() {
    // No individual legislative candidate pages for 2026
    // Candidates are shown inline via the district selector
    return []
}

export function getCandidateData(candidateSlug) {
    return getLegislativeCandidates().find(d => d.slug === candidateSlug)
}