const fs = require('fs')
const readXlsxFile = require('read-excel-file/node')

const writeJson = (path, data) => {
    fs.writeFile(path, JSON.stringify(data, null, 2), err => {
        if (err) throw err
        console.log('JSON written to', path)
    })
}

// DONE: Update paths
const PATH_STATEWIDE = './inputs/results/raw/2026_06_12_primary-statewide.xlsx'
const PATH_LEGISLATIVE = './inputs/results/raw/2026_06_12_primary-legislative.xlsx'
// DONE: Update races
const STATEWIDE_RACES_TO_INCLUDE = {
    'UNITED STATES SENATOR': 'us-senate',
    'UNITED STATES REPRESENTATIVE 1ST CONGRESSIONAL': 'us-house-1',
    'UNITED STATES REPRESENTATIVE 2ND CONGRESSIONAL': 'us-house-2',
    // 'GOVERNOR & LT. GOVERNOR': 'governor',
    // 'SECRETARY OF STATE': 'secretary-of-state',
    // 'ATTORNEY GENERAL': 'attorney-general',
    // 'STATE AUDITOR': 'state-auditor',
    'STATE SUPERINTENDENT OF PUBLIC INSTRUCTION': 'superintendent',
    'PUBLIC SERVICE COMMISSIONER, DISTRICT 1': 'psc-1',
    'PUBLIC SERVICE COMMISSIONER, DISTRICT 5': 'psc-5',
    // 'PUBLIC SERVICE COMMISSIONER, DISTRICT 4': 'psc-4',
    // 'CLERK OF THE SUPREME COURT': 'clerk-of-court',
    // 'SUPREME COURT CHIEF JUSTICE': 'supco-chief-justice',
    'SUPREME COURT JUSTICE #4': 'supco-4',
}

const NAME_SUBS = {
    // necessary to merge with other data
    "SIDNEY CHIP FITZPATRICK": "SIDNEY 'CHIP' FITZPATRICK"
}
const cleanName = name => NAME_SUBS[name] || name.trim()

function getSheetData({ sheet: sheetName, data }) {
    const partyMatch = sheetName.match(/(REP)|(DEM)|(LIB)|(GRN)|(NON)/)
    if (!partyMatch) return null
    const party = partyMatch.find(d => d !== null)[0].replace('N', 'NP')

    const reportingTime = String(data[3][0]).replace('Downloaded at ', '')

    const colsRow = data.find(row => row[1] === 'County')
    const totalsRow = data.find(row => row[1] === 'TOTALS')
    if (!colsRow || !totalsRow) return null

    const race = String(colsRow[0]).replace('\r\n', ' ')
    const candidateNames = colsRow.slice(2).filter(v => v != null)
    const voteTotals = totalsRow.slice(2)

    const resultsTotal = candidateNames.map((name, i) => {
        return {
            candidate: cleanName(String(name).split('\n')[0]),
            party,
            votes: voteTotals[i] || 0,
        }
    }).sort((a, b) => b.votes - a.votes)

    const totalVotes = resultsTotal.reduce((acc, obj) => acc + obj.votes, 0)
    const mostVotes = resultsTotal.reduce((acc, obj) => (acc < obj.votes) ? obj.votes : acc, 0)

    resultsTotal.forEach(d => {
        d.isWinner = (d.votes === mostVotes)
        d.votePercent = d.votes / totalVotes
    })

    return {
        race,
        party,
        // precinctsFull: 'TK',
        // precinctsPartial: 'TK',
        reportingTime,
        resultsTotal,
        // resultsByCounty
    }
}

async function main() {
    const statewideSheets = await readXlsxFile(PATH_STATEWIDE)
    const statewide = statewideSheets
        .map(getSheetData)
        .filter(d => d && Object.keys(STATEWIDE_RACES_TO_INCLUDE).includes(d.race))
    statewide.forEach(d => {
        d.race = STATEWIDE_RACES_TO_INCLUDE[d.race]
    })
    writeJson('./inputs/results/cleaned/2026-primary-statewide.json', statewide)

    const legislativeSheets = await readXlsxFile(PATH_LEGISLATIVE)
    const legislative = legislativeSheets
        .map(getSheetData)
        .filter(d => d !== null)
    legislative.forEach(d => {
        d.race = d.race
            .replace('STATE REPRESENTATIVE DISTRICT ', 'HD-')
            .replace('STATE SENATOR DISTRICT ', 'SD-')
    })
    writeJson('./inputs/results/cleaned/2026-primary-legislative.json', legislative)
}

main().catch(console.error)