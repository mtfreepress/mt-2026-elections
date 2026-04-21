import React from 'react'
import { css } from '@emotion/react'

import TruncatedContainer from '../design/TruncatedContainer'

import { PARTIES, PARTIES_BY_KEY } from '../lib/styles'
import { dollarFormatResponsive } from '../lib/utils'

const candidatePageUrl = candidateId => `https://www.fec.gov/data/candidate/${candidateId}/?cycle=2026&election_full=true`

const FEC_PAGES = {
    'us-senate': 'https://www.fec.gov/data/elections/senate/MT/2026/',
    'us-house-1': 'https://www.fec.gov/data/elections/house/MT/01/2026/',
    'us-house-2': 'https://www.fec.gov/data/elections/house/MT/02/2026/',
}

const style = css`
    .ledein, .outro {
        margin: 0.5em 0;
        margin-bottom: 1em;
    }

    .table {
        /* max-width: 600px; */
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        /* border-bottom: 1px solid var(--tan2); */
        margin: 0.2em 0;
        padding: 0.4em;
    }
    .row.focus {
        background: var(--tan1);
    }
    .row.thead {
        font-style: italic;
        color: var(--gray5);
    }
    .label-cell {
        flex: 1 0 8em;
        
    }
    .num-cell {
        flex: 1 0 2em;
        padding: 0.2em;
        font-weight: bold;
        display: flex;
        justify-content: flex-end;
        align-items: center;

        @media screen and (max-width: 350px) {
            font-size: 12px;
        }
    }

    .note-line {
        font-size: 0.8em;
        font-style: italic;
        margin-left: 0.2em;
    }
`

export default function RaceFinance(props) {
    const { finance, raceSlug } = props

    const activeCandidates = finance.filter(d => d.candidateStatus === 'active')
    const inactiveCandidates = finance.filter(d => d.candidateStatus !== 'active')

    const fecRaceSummaryUrl = FEC_PAGES[raceSlug]
    if (!fecRaceSummaryUrl) console.warn('Missing FEC race page for:', raceSlug)

    return <div css={style}>
        <div className="ledein">Based on reporting required by the U.S. Federal Election Commission. See individual candidate committee pages on the FEC website or the FEC <a href={fecRaceSummaryUrl}>race summary page</a> for more information.</div>

        <div className="table">
            <div className="row thead">
                <div className="label-cell">Candidate</div>
                <div className="num-cell">Raised</div>
                <div className="num-cell">Spent</div>
                <div className="num-cell">Remaining</div>
            </div>
            {
                activeCandidates.map((d, i) => <Row key={String(i)} {...d} />)
            }
            {
                (inactiveCandidates.length > 0) && <TruncatedContainer
                    height={1}
                    defaultState={false}
                    closedText={`Show ${inactiveCandidates.length} candidate${inactiveCandidates.length === 1 ? '' : 's'} defeated in primary`}
                    openedText={`Hide ${inactiveCandidates.length} candidate${inactiveCandidates.length === 1 ? '' : 's'} defeated in primary`}
                    buttonPlacement='above'

                >
                    {
                        inactiveCandidates.map((d, i) => <Row key={String(i)} {...d} />)
                    }
                </TruncatedContainer>
            }

        </div>
        <div className="outro"> The FEC summary page may include candidates who did not file for the ballot in this race with the Montana Secretary of State. Additionally, some active candidates may not appear on this list because they are not required to file paperwork with the FEC until they raise or spend at least $5,000 on their campaigns.</div>
    </div>
}

const Row = props => {
    const {
        isThisCandidate,
        displayName,
        party,
        candidateCommitteeName,
        candidateId,
        totalReceipts,
        totalDisbursments,
        cashOnHand,
        coverageEndDate,
    } = props
    // const candidatePageUrl = `https://www.fec.gov/data/candidate/${candidateId}/?cycle=${}&election_full=true`
    const partyInfo = PARTIES_BY_KEY.get(party) ||
        PARTIES_BY_KEY.get(party && party.toUpperCase()) ||
        PARTIES.find(d => d.noun === party || d.adjective === party) ||
        { color: '#666' }
    return <div className={`row ${isThisCandidate ? 'focus' : ''}`}
        style={{
            border: `1px solid ${partyInfo.color}`,
            borderLeft: `4px solid ${partyInfo.color}`
        }}
    >
        <div className="label-cell">
            <div>{displayName} ({party})</div>
            <div className="note-line">
                {
                    coverageEndDate && <div>
                        <div><a href={candidatePageUrl(candidateId)}>{candidateCommitteeName}</a></div>
                        <div>thru {coverageEndDate}</div>
                    </div>
                }
                {
                    !coverageEndDate && <span>No FEC filings on record</span>
                }
            </div>
        </div>
        <div className="num-cell">{dollarFormatResponsive(totalReceipts)}</div>
        <div className="num-cell">{dollarFormatResponsive(totalDisbursments)}</div>
        <div className="num-cell">{dollarFormatResponsive(cashOnHand)}</div>
    </div>
}

