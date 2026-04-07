const fs = require('fs')
const path = require('path')
const csv = require('async-csv')
const yaml = require('js-yaml')

const RAW_DIR = path.join('.', 'inputs', 'mtfp-questionnaire', 'raw-answers')
const OUT_PATH = path.join('.', 'inputs', 'mtfp-questionnaire', 'copy-for-edit.yml')

const CANDIDATE_NAME_VARIANTS = [
    "What is the candidate's name as it will appear on the ballot?",
    "What is the candidate’s name as it will appear on the ballot?",
    'Candidate name',
    'Candidate name:'
]

const EXCLUDE_PATTERNS = [
    /timestamp/i,
    /email/i,
    /press/i,
]

function writeYaml(outPath, data) {
    const yamlData = yaml.dump(data, { lineWidth: -1, quotingType: '"' })
    fs.writeFileSync(outPath, yamlData, 'utf8')
    console.log('YAML written to', outPath)
}

async function getCsv(p) {
    const string = fs.readFileSync(p, 'utf-8')
    return csv.parse(string, { bom: true, columns: true, relax_column_count: true })
}

function findCandidateKeyInRow(row) {
    const keys = Object.keys(row)
    for (const v of CANDIDATE_NAME_VARIANTS) if (keys.includes(v)) return v
    // fallback: key that contains both 'candidate' and 'name'
    let k = keys.find(k => /candidate/i.test(k) && /name/i.test(k))
    if (k) return k
    // fallback: any key containing 'ballot'
    k = keys.find(k => /ballot/i.test(k))
    if (k) return k
    // fallback: any key with the word 'name'
    k = keys.find(k => /\bname\b/i.test(k))
    return k || null
}

function toSlugPart(s) {
    return s
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-]+|[-]+$/g, '')
        .toLowerCase()
}

function generateNameSlug(fullName) {
    if (!fullName || !String(fullName).trim()) return 'tk-eric-will-fill-out'
    let s = String(fullName).trim()
    s = s.replace(/["“”‘’]/g, '')
    s = s.replace(/[,]/g, '')
    s = s.replace(/\(.*?\)/g, '').trim()
    s = s.replace(/^(mr|mrs|ms|dr|judge|hon)\.?\s+/i, '')
    s = s.replace(/\s+(jr|sr|ii|iii|iv|v|phd|md|esq)\.?$/i, '')

    const tokens = s.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return 'tk-eric-will-fill-out'
    if (tokens.length === 1) return toSlugPart(tokens[0])
    if (tokens.length === 2) return `${toSlugPart(tokens[0])}-${toSlugPart(tokens[1])}`

    // tokens.length >= 3
    // If the second token looks like an initial (single letter or letter+period), use first-middleInitial-last
    const second = tokens[1].replace(/\./g, '')
    if (/^[A-Za-z]$/.test(second)) {
        const first = toSlugPart(tokens[0])
        const mid = toSlugPart(second[0])
        const last = tokens.slice(2).map(toSlugPart).filter(Boolean).join('-')
        return `${first}-${mid}-${last}`
    }

    // Otherwise assume the remainder is the last name (covers multi-word last names like "Walking Child")
    const first = toSlugPart(tokens[0])
    const last = tokens.slice(1).map(toSlugPart).filter(Boolean).join('-')
    return `${first}-${last}`
}

function isExcludedHeader(h) {
    if (!h) return true
    return EXCLUDE_PATTERNS.some(re => re.test(h))
}

function isBioQuestion(header) {
    if (!header) return false
    const h = header.toLowerCase()
    const bioKeywords = ['professional', 'life experience', 'where do you live', 'born', 'biograph', 'age', 'voters', 'why are you running', 'in a single sentence', 'what other biographical']
    return bioKeywords.some(k => h.includes(k))
}

function processResponse(row) {
    const candidateKey = findCandidateKeyInRow(row)
    const candidateName = candidateKey ? (row[candidateKey] || '').trim() : ''
    const nameSlug = generateNameSlug(candidateName)

    const allKeys = Object.keys(row)
    const bioMaterial = []
    const questionnaireMaterial = []

    for (const k of allKeys) {
        if (!k) continue
        if (candidateKey && k === candidateKey) continue
        if (isExcludedHeader(k)) continue
        const response = (row[k] || '').toString().trim()
        if (isBioQuestion(k)) {
            bioMaterial.push({ question: k, response: response + '\n\n' })
        } else {
            questionnaireMaterial.push({ question: k, response: response + '\n\n' })
        }
    }

    return {
        candidateName,
        nameSlug,
        bioMaterial,
        mtfpTitle: 'TK here',
        mtfpWrittenBio: 'TK MTFP-written bio\n\n',
        questionnaireMaterial,
    }
}

async function main() {
    let csvFiles = []
    if (fs.existsSync(RAW_DIR)) {
        csvFiles = fs.readdirSync(RAW_DIR).filter(f => f.toLowerCase().endsWith('.csv')).map(f => path.join(RAW_DIR, f))
    }

    if (csvFiles.length === 0) {
        console.error('No CSV files found in', RAW_DIR)
        process.exitCode = 1
        return
    }

    const allRows = []
    for (const f of csvFiles) {
        try {
            const rows = await getCsv(f)
            console.log(`Read ${rows.length} rows from ${f}`)
            // rows.forEach(r => { r.__source = path.basename(f) })
            allRows.push(...rows)
        } catch (err) {
            console.error('Error parsing', f, err)
        }
    }

    const filtered = allRows.filter(r => {
        const key = findCandidateKeyInRow(r)
        return key && r[key] && String(r[key]).trim().length > 0
    })

    const responses = filtered.map(processResponse)
    writeYaml(OUT_PATH, responses)
    console.log('Wrote', responses.length, 'candidate entries to', OUT_PATH)
}

main()