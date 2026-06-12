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
        align-items: center;
        padding: 0.5em 0;
        height: auto;
        min-height: 50px;
        font-size: 16px;

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
        padding: 0.3em 0.6em;
        margin-right: 0.6em;
        margin-left: 0;
        flex-shrink: 0;
    }
    .result-row-name {
        flex: 0 0 13em;
        color: var(--gray4);
        margin-right: 0.8em;
        padding-left: 5px;
        display: flex;
        align-items: center;
    }
    .result-row-percent {
        flex: 0 0 4em;
        margin-right: 1em;
        text-align: right;
        flex-shrink: 0;
    }
    .result-row-bar {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.5em;
    }
    .result-row-bar svg {
        flex: 1 1 auto;
        min-width: 0;
    }
    .result-percent-label {
        flex: 0 0 auto;
        white-space: nowrap;
        color: var(--gray4);
        font-weight: normal;
    }
    .date {
        font-style: italic;
        font-size: 14px;
        margin-top: 1em;
        margin-left: 0.3em;
    }

    @media screen and (max-width: 768px) {
        .result-row {
            min-height: 45px;
            font-size: 12px;
        }
        .result-row-name {
            flex: 0 0 11em;
        }
        .winner-icon {
            padding: 0.2em 0.5em;
            margin-right: 0.4em;
        }
    }

    @media screen and (max-width: 600px) {
        .result-row {
            min-height: 50px;
            font-size: 21px;
            flex-wrap: wrap;
            padding-left: 0.8em;
        }
        .result-row-name {
            flex: 0 0 100%;
            margin-bottom: 0.6em;
            padding-left: 0;
        }
        .result-row-percent {
            flex: 0 0 auto;
            margin-right: 0.5em;
        }
        .result-row-bar {
            flex: 1 1 auto;
            width: calc(100% - 0.8em);
        }
        .winner-icon {
            padding: 0.4em 0.7em;
            margin-right: 0.6em;
            font-size: 16px;
        }
        .result-percent-label {
            font-size: 21px;
        }
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

const BAR_RANGE = 200
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
        <td className="result-row-bar"><svg width="100%" height={50} viewBox={`0 0 ${BAR_RANGE + 20} 50`} preserveAspectRatio="xMinYMid meet">
            <rect fill={partyInfo.color} x={0} y={5} height={40} width={barWidth} />
        </svg>
        <span className="result-percent-label">{percentFormat(votePercent)}</span></td>
    </tr>
}
