import fs from 'fs'
import path from 'path'
import text from '../data/text.json'

// Resolve from the project root so this works both during `next build`
// (cwd = project root) and in tests.
const dataDir = path.join(process.cwd(), 'src/data')

export function getAllCandidateIds() {
    // Read the thin index — no per-candidate file reads needed here.
    const index = JSON.parse(fs.readFileSync(path.join(dataDir, 'candidates-index.json'), 'utf8'))
    return index.map(d => d.slug)
}

export function getCandidateData(candidateSlug) {
    // Each candidate has its own JSON file so page builds load only the data
    // they actually need rather than the entire candidates array.
    const filePath = path.join(dataDir, 'candidates', `${candidateSlug}.json`)
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function getCandidatePageText() {
    return {
        overviewAboutThisProject: text.overviewAboutThisProject,
    }
}