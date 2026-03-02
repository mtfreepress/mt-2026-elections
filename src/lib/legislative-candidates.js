import legislativeCandidates from '../data/legislative-candidates.json'

export function getAllCandidateIds() {
    // No individual legislative candidate pages for 2026
    // Candidates are shown inline via the district selector
    return []
}

export function getCandidateData(candidateSlug) {
    return legislativeCandidates.find(d => d.slug === candidateSlug)
}