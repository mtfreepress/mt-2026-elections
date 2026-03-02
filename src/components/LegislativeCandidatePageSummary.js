import { css } from "@emotion/react";
import Image from 'next/image'
import { useRouter } from 'next/router';

import { PARTIES } from '../lib/styles'

const summaryStyle = css`
    margin-top: 0.5em;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: stretch;
    background-color: var(--tan1);
    box-shadow: 2px 2px 4px #aaa;
    color: black;
    
    .map-col {
        flex: 1 0 100px;
        display: flex;
        justify-content: center;
        /* border: 2px solid black; */
        /* background: var(--tan6); */
        
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
        font-size: 3em;
        margin: 0.5em;
        text-align: center;
    }
    .summary-line {
        font-style: italic;
        font-size: 1.3em;
    }
    .incumbent-line {
        font-size: 1.3em;
        text-align: center;
        font-style: italic;

        a {
            margin-top: 0.3em;
            margin-bottom: 0.5em;
            padding: 0.1em;
            display: block;
            color: black;
            border: 2px solid black;
            box-shadow: 2px 2px 3px #aaa;
            color: var(--link);
            border: 2px solid var(--link);
        }
        a:hover {
            text-decoration: none;
            color: var(--highlight);
            border: 2px solid var(--highlight);
        }
    }
`

export default function CandidatePageSummary(props) {
    const {
        displayName,
        party,
        summaryLine,
        raceDisplayName,
        raceSlug,
        cap_tracker_2023_link,
    } = props
    
    const router = useRouter()
    const partyInfo = PARTIES.find(d => d.key === party)
    return <div css={summaryStyle} style={{ borderTop: `5px solid ${partyInfo.color}` }}>

        <div className="info-col">
            <div className="info-container">
                <div className="intro-line"><strong style={{ color: partyInfo.color }}>{partyInfo.adjective}</strong> candidate for</div>
                <div className="position-line">MONTANA <strong>{raceDisplayName}</strong></div>
                <h1 className="name">{displayName}</h1>
                {cap_tracker_2023_link && <div className="incumbent-line">
                    <div>Member of 2023 Legislature</div>
                    <a href={cap_tracker_2023_link}>View legislative record »</a>
                </div>}
            </div>
        </div>
        <div className="map-col">
            {(() => {
                const m = String(raceSlug).match(/^([A-Z]{2}-)(\d+)$/)
                const file = m ? `${m[1]}${m[2].padStart(2, '0')}.jpg` : `${raceSlug}.jpg`
                return (
                    <Image src={`${router.basePath}/maps/lege-maps-1200px/${file}`}
                        width={300}
                        height={300}
                        alt={`Map of ${raceDisplayName}`}
                        priority={true}
                    />
                )
            })()}
        </div>
    </div>
}