const test = require('node:test')
const assert = require('node:assert/strict')

const {
    candidateKey,
    isActiveCandidate,
    isWriteInCandidate,
    mergeCandidateHistory,
    parseCandidateCsv,
} = require('../inputs/filings/candidate-lists')
const { parseWebsite } = require('../inputs/content/generate-candidate-yml')

function candidate(name, party, status = 'FILED', emailWeb = 'candidate@example.com<br />Not Provided') {
    return {
        Status: status,
        'District Type': 'House',
        District: 'HOUSE DISTRICT 22',
        Race: 'STATE REPRESENTATIVE DISTRICT 22',
        Name: name,
        'Party Preference': party,
        'Email/Web Address': emailWeb,
    }
}

test('general rows override matching primary rows without discarding primary-only history', () => {
    const primary = [
        candidate('JIM', 'REP'),
        candidate('BOB', 'REP', 'NOMINATED'),
        candidate('BILL', 'DEM', 'NOMINATED'),
        candidate('ALICE', 'DEM'),
    ]
    const general = [
        candidate('BOB', 'REP'),
        candidate('BILL', 'DEM', 'WITHDRAWN'),
        candidate('JAMIE', 'DEM', 'FILED', 'jamie@example.com<br />WRITE-IN'),
    ]

    const merged = mergeCandidateHistory(primary, general)
    const bill = merged.find(row => candidateKey(row) === candidateKey(general[1]))

    assert.equal(merged.length, 5)
    assert.equal(bill.Status, 'WITHDRAWN')
    assert.ok(merged.some(row => row.Name === 'JIM'))
    assert.ok(merged.some(row => row.Name === 'JAMIE'))
    assert.deepEqual(general.filter(isActiveCandidate).map(row => row.Name), ['BOB', 'JAMIE'])
})

test('WRITE-IN is metadata, not a campaign website', () => {
    const writeIn = candidate('JAMIE', 'DEM', 'FILED', 'jamie@example.com<br />WRITE-IN')
    const writeInWithoutHyphen = candidate('JAMIE', 'DEM', 'FILED', 'jamie@example.com<br />WRITE IN')

    assert.equal(isWriteInCandidate(writeIn), true)
    assert.equal(isWriteInCandidate(writeInWithoutHyphen), true)
    assert.equal(parseWebsite(writeIn['Email/Web Address']), '')
    assert.equal(parseWebsite(writeInWithoutHyphen['Email/Web Address']), '')
})

test('candidate CSV parsing handles the Secretary of State format and BOM', () => {
    const csv = '\uFEFF"Status","District Type","District","Race","Name","Email/Web Address","Party Preference"\n'
        + '"FILED","House","HOUSE DISTRICT 22","STATE REPRESENTATIVE DISTRICT 22","JAMIE","JAMIE@EXAMPLE.COM<br />WRITE-IN","DEM"\n'
    const rows = parseCandidateCsv(csv)

    assert.equal(rows.length, 1)
    assert.equal(rows[0].Name, 'JAMIE')
    assert.equal(isWriteInCandidate(rows[0]), true)
})
