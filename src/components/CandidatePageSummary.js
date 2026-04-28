import { css } from "@emotion/react";

import { useRouter } from 'next/router';
import Image from "next/image";

import { PARTIES_BY_KEY } from '../lib/styles'

const summaryStyle = css`
    margin-top: 0.5em;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: stretch;
    background-color: var(--tan1);
    box-shadow: 2px 2px 4px #aaa;
    color: black;
    
    .portrait-col {
        flex: 1 0 100px;
        max-width: 400px;
    }
    .portrait-container {
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        overflow: hidden;
        background-color: #666;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
    }
    .info-col {
        flex: 1 1 400px;
        padding: 0.5em 1em;
        position: relative;

        display: flex;
        align-items: center;
        justify-content: center;
       
    }
    .info-container {
        /* border: 1px solid red; */
    }
    .intro-line {
        margin-top: 0.5em;
        font-size: 1.2em;
        text-transform: uppercase;
        text-align: center;
    }
    .position-line {
        font-size: 1.3em;
        text-transform: uppercase;
        text-align: center;
    }
    .name {
        font-weight: bold;
        font-size: clamp(2rem, 8vw, 3em);
        text-align: center;
    }
    .summary-line {
        font-style: italic;
        font-size: clamp(1rem, 4.5vw, 1.3em);
        text-align: center;
    }

    @media screen and (max-width: 600px) {
        .info-col {
            padding: 0.75em;
        }

        .intro-line {
            font-size: 1.05em;
        }

        .position-line {
            font-size: 1.1em;
        }
    }
`

export default function CandidatePageSummary(props) {
    const {
        slug,
        displayName,
        party,
        summaryLine,
        raceDisplayName,
        hasPortrait,
    } = props

    const partyInfo = PARTIES_BY_KEY.get(party) || { color: '#000', adjective: party || '' }
    const router = useRouter()
    const portraitSrc = hasPortrait
        ? `${router.basePath}/portraits/${slug}.webp`
        : `${router.basePath}/portraits/no-match.webp`

    return <div css={summaryStyle} style={{ borderTop: `5px solid ${partyInfo.color}` }}>

        <div className="portrait-col">
            <div className="portrait-container">
                <Image
                    alt={`${displayName}`}
                    src={portraitSrc}
                    width={250}
                    height={250}
                    priority
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            </div>
        </div>
        <div className="info-col">
            <div className="info-container">
                <div className="intro-line">
                    <div>Montana <strong style={{ color: partyInfo.color }}>{partyInfo.adjective}</strong> candidate</div>
                    <div> for <strong>{raceDisplayName}</strong></div>
                </div>
                <h1 className="name">{displayName}</h1>
                <div className="summary-line">{summaryLine}</div>
            </div>
        </div>
    </div>
}