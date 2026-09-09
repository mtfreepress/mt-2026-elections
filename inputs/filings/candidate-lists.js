const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

const PRIMARY_CANDIDATE_LIST = path.join(__dirname, 'PrimaryCandidateList.csv')
const GENERAL_CANDIDATE_LIST = path.join(__dirname, 'GeneralCandidateList.csv')

const ACTIVE_CANDIDATE_STATUSES = new Set(['FILED', 'NOMINATED', 'PENDING PETITION'])

function parseCandidateCsv(content) {
    return parse(content, {
        bom: true,
        columns: true,
        relax_column_count: true,
        skip_empty_lines: true,
    })
}

function readCandidateCsv(filePath) {
    return parseCandidateCsv(fs.readFileSync(filePath, 'utf8'))
}

function normalizeCandidateName(name) {
    return String(name || '')
        .replace(/^\*/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
}

function candidateKey(candidate) {
    return [
        candidate['District Type'],
        candidate.District,
        candidate.Race,
        normalizeCandidateName(candidate.Name),
    ].map(value => String(value || '').trim().toLowerCase()).join('||')
}

function isActiveCandidate(candidate) {
    return ACTIVE_CANDIDATE_STATUSES.has(String(candidate.Status || '').trim().toUpperCase())
}

function isWriteInCandidate(candidate) {
    const parts = String(candidate['Email/Web Address'] || '').split(/<br\s*\/?>/i)
    return parts.slice(1).some(value => /^WRITE[-\s]IN$/i.test(value.trim()))
}

/**
 * Retain the complete primary snapshot while applying every row present in the
 * general list over its matching primary row. Primary-only candidates remain
 * available as history, but current-ballot consumers should use the general
 * rows directly.
 */
function mergeCandidateHistory(primaryCandidates, generalCandidates) {
    const merged = new Map(primaryCandidates.map(candidate => [candidateKey(candidate), candidate]))
    generalCandidates.forEach(candidate => merged.set(candidateKey(candidate), candidate))
    return [...merged.values()]
}

module.exports = {
    ACTIVE_CANDIDATE_STATUSES,
    GENERAL_CANDIDATE_LIST,
    PRIMARY_CANDIDATE_LIST,
    candidateKey,
    isActiveCandidate,
    isWriteInCandidate,
    mergeCandidateHistory,
    normalizeCandidateName,
    parseCandidateCsv,
    readCandidateCsv,
}
