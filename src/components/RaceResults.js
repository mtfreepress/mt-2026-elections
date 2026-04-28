import { css } from '@emotion/react'

import { PARTIES_BY_KEY } from '../lib/styles'
import { numberFormat, percentFormat, formatDate } from '../lib/utils'

const style = css`
    padding: 0.5em;
    .title {
        font-style: italic;
        margin-bottom: 0.5em;
    }
    table {
        /* border: 1px solid red; */
        width: 100%;
    }
    thead > .result-row {
        border-left: 5px solid white;
    }
    .result-row {
        display: flex;
        padding: 0.2em 0;
        height: 16px;
        font-size: 12px;

        border-bottom: 1px solid var(--gray2);

        th {
            color: var(--gray4);
            font-weight: normal;
        }
    }
    .winner-icon {
        background-color: #666;
        color: white;
        font-weight: bold;
        padding: 0.2em 0.5em;
        margin-right: 0.4em;
        margin-left: 0;
    }
    .result-row-name {
        flex: 0 0 13em;
        color: var(--gray4);
        margin-right: 0.5em;
        padding-left: 5px;
        

    }
    .result-row-percent {
        flex: 0 0 4em;
        margin-right: 0.5em;
        text-align: right;
    }
    .result-row-bar {
        flex: 0 0 auto;
    }
    .date {
        font-style: italic;
        font-size: 14px;
        margin-top: 1em;
        margin-left: 0.3em;
    }
`

const RaceResults = props => {
    const { title, primaryParty, results } = props
    const timestamp = results.reportingTime
    const primaryPartyLabel = primaryParty ? PARTIES_BY_KEY.get(primaryParty).adjective : null

    return <div css={style}>
        <div className="title">{title}{primaryParty && ` – ${primaryPartyLabel} candidates`}</div>
        <table>
            <thead>
                <tr className="result-row">
                    <th className="result-row-name">Candidate</th>
                    <th className="result-row-percent">Votes</th>
                    <th className="result-row-bar">Percentage</th>
                </tr>
            </thead>
            <tbody>{
                results.resultsTotal
                    .sort((a, b) => b.votes - a.votes)
                    .map((d, i) => <Row key={String(i)} {...d} />)
            }</tbody>
        </table>
        <div className="date">Count reported by Montana secretary of state as of {formatDate(new Date(timestamp))}.</div>
    </div>
}

export default RaceResults

const BAR_RANGE = 60
const Row = ({ candidate, votes, votePercent, isWinner, party }) => {
    const partyInfo = PARTIES_BY_KEY.get(party)
    const barWidth = votePercent * BAR_RANGE
    return <tr className="result-row" style={{
        backgroundColor: isWinner ? 'var(--gray1)' : 'none',
        borderLeft: `5px solid ${partyInfo.color}`,
        fontWeight: isWinner ? 'bold' : 'normal',
    }}>
        <td className="result-row-name">
            {isWinner ? <span className="winner-icon" style={{ backgroundColor: partyInfo.color }}>✓</span> : ''}
            {candidate}
        </td>
        <td className="result-row-percent">{numberFormat(votes)}</td>
        <td className="result-row-bar"><svg width={BAR_RANGE + 50} height={14}>
            <rect fill={partyInfo.color} x={0} y={0} height={18} width={barWidth} />
            <text x={barWidth + 5} y={12}>{percentFormat(votePercent)}</text>
        </svg></td>
    </tr>
}
