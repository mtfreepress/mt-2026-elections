import React from 'react'
import { css } from "@emotion/react";
import { useRouter } from 'next/router';
import Image from "next/image";
import Link from "next/link";

import {
    getCorrespondingHouseDistrictNumbers,
    getCorrespondingSenateDistrictNumber
} from '../lib/utils'

import { PARTIES_BY_KEY } from "@/lib/styles";

const legislativeOverviewStyle = css`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    align-items: stretch;

    .col {
        flex: 1 1 300px;
        min-width: min(100%, 300px);
        margin: 0.5em;
    }

    @media screen and (max-width: 720px) {
        .col {
            margin: 0.5em 0;
        }
    }
`

const districtStyle = css`
    border: 1px solid var(--tan5);
    box-shadow: 2px 2px 3px #aaa;
    height: calc(100% - 1em);
    padding: 0.5em;

    .corresponding-district {
        text-align: center;
        margin-bottom: 0.5em;
    }

    .locale {
        padding: 0.2em;
        min-height: 2.5em;
    }

    .map-container {
        display: flex;
        justify-content: center;

        img {
            border: 1px solid var(--tan5);
            /* box-shadow: 2px 2px 3px #aaa; */
        }
    }

    .out-of-cycle-note {
        background: var(--gray1);
        border: 1px solid var(--tan5);
        margin: 0.5em 0;
        padding: 1em;
        font-size: 1.1em;
        text-align: center;
    }
    .candidates {
        margin-bottom: 1em;
    }
    .holdover {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--tan5);
        background: var(--gray1);
        min-height: 37px;
        padding-right: 1em;
        box-shadow: 2px 2px 3px #aaa;
        margin-bottom: 0.5em;
        color: black;
    }
    .holdover:hover {
        opacity: 0.8;
        text-decoration: none;
        color: var(--link);
    }
    .holdover-party-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: white;
        width: 40px;
        height: 100%;
        font-size: 1.1em;
        margin-right: 0.5em;
        position: relative;
        top: 0px;
        padding-top: 0;

    }
    .holdover-name {
        font-size: 1.1em;
        text-transform: uppercase;
        
    }

    @media screen and (max-width: 420px) {
        .holdover {
            width: 100%;
            padding-right: 0.65em;
        }

        .holdover-name {
            font-size: 1em;
        }
    }
`

const candidateStyle = css`
    margin-top: 0.5em;
    border: 1px solid var(--tan5);
    box-shadow: 2px 2px 3px #aaa;
    a {
        /* width: 180px; */
        min-height: 40px;
        display: flex;
        align-items: stretch;
        background-color: var(--tan1);
        
        
        color: black;
    }
    a:hover {
        opacity: 0.8;
        text-decoration: none;
        /* border: 2px solid black; */
        color: var(--link);
    }
    
    /* .portrait-col {
        flex: 0 0 40px;
        height: 100%;
    } */
    .party {
        width: 40px;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.2em;
        color: white;
    }
    .info-col {
        flex: 1 1 100px;
        padding: 0.5em 0.5em;
        position: relative;
        
        display: flex;
        align-items: center;
    }
    .name {
        font-size: 1.1em;
        margin-bottom: 0;
    }
    .incumbent-marker {
        margin-left: 0.15em;
        font-weight: 700;
    }
    .tag-line {
        font-size: 0.8em;
        margin-top: 0.2em;
    }
    .tag {
        /* display: inline-block; */
        /* border: 1px solid var(--tan4); */
        /* padding: 0.2em 0.5em; */
    }
    .tag:not(:last-child):after {
        content: ' •'
    }
    .current {
        font-size: 0.9em;
        font-style: italic;
        color: var(--gray3);
    }
    .summary-line {
        font-style: italic;
        font-size: 0.9em;
    }
    .fakelink {
        position: absolute;
        bottom: 3px;
        right: 8px;
        color: var(--tan4);
    }
`

function Candidate(props) {
    const { displayName, party, campaignWebsite, isIncumbent } = props
    const partyInfo = PARTIES_BY_KEY.get(party)
    const inner = <>
        <div className="portrait-col" >
            <div className="party" style={{ background: partyInfo.color }}>{party}</div>
        </div>
        <div className="info-col">
            <div>
                <div className="name">
                    {displayName}
                    {isIncumbent && <span className="incumbent-marker" aria-label="Incumbent">*</span>}
                </div>
            </div>
            {campaignWebsite && <div className="fakelink">Website »</div>}
        </div>
    </>

    if (campaignWebsite) {
        return <div css={candidateStyle} style={{ borderTop: `3px solid ${partyInfo.color}` }}>
            <a href={campaignWebsite} target="_blank" rel="noopener noreferrer">
                {inner}
            </a>
        </div>
    }

    return <div css={candidateStyle} style={{ borderTop: `3px solid ${partyInfo.color}` }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '40px', backgroundColor: 'var(--tan1)' }}>
            {inner}
        </div>
    </div>
}


const District = (props) => {
    const {
        districtKey, district, chamber,
        region, locale,
        in_cycle_2024, in_cycle_2026,
        holdover_senator, holdover_party, holdover_link,
        candidates } = props

    const CYCLE_YEAR = 2026
    const inCycleValue = (typeof in_cycle_2026 !== 'undefined') ? in_cycle_2026 : in_cycle_2024

    let correspondingHouseDistricts = []
    if (chamber === 'senate') {
        correspondingHouseDistricts = getCorrespondingHouseDistrictNumbers(districtKey)
    }
    let correspondingSenateDistrict = null
    if (chamber === 'house') {
        correspondingSenateDistrict = getCorrespondingSenateDistrictNumber(districtKey)
    }
    const router = useRouter()
    const holdoverPartyInfo = PARTIES_BY_KEY.get(holdover_party)
    const activeCandidates = candidates.filter(c => c.status === 'active')
    const inactiveCandidates = candidates.filter(c => c.status !== 'active')


    return <div css={districtStyle}>
        <h3>{district.replace('HD', 'House District').replace('SD', 'Senate District')}</h3>

        <div className="locale"><strong>{region}</strong> — {locale}</div>

        <div className="map-container">
            {(() => {
                const m = String(districtKey).match(/^([A-Z]{2}-)(\d+)$/)
                const file = m ? `${m[1]}${m[2].padStart(2, '0')}.webp` : `${districtKey}.webp`
                return (
                    <Image src={`${router.basePath}/maps/webp-maps-600px/${file}`}
                        width={300}
                        height={300}
                        alt={`Map of ${district}`}
                        loading="lazy"
                    />
                )
            })()}
        </div>

        {(chamber === 'house') && <div className="note corresponding-district">Part of SD {correspondingSenateDistrict}</div>}
        {(chamber === 'senate') && <div className="note corresponding-district">Composed of HD {correspondingHouseDistricts[0]} and HD {correspondingHouseDistricts[1]}</div>}

        {(chamber === 'senate') && (inCycleValue === 'no') && <div>
            <div className="out-of-cycle-note">
                <div><strong>{district}</strong> is out of cycle in {CYCLE_YEAR}</div>
                <br />
                <div>
                    {holdover_link ? (
                        <Link className="holdover" href={holdover_link} style={{ borderTop: `3px solid ${holdoverPartyInfo?.color || '#999'}` }}>
                            <span className="holdover-party-icon" style={{ backgroundColor: holdoverPartyInfo?.color || '#999' }}>{holdover_party}</span>
                            <span className="holdover-name">Sen. {holdover_senator}</span>
                        </Link>
                    ) : (
                        <a className="holdover" href="#" onClick={e => e.preventDefault()} style={{ borderTop: `3px solid ${holdoverPartyInfo?.color || '#999'}` }}>
                            <span className="holdover-party-icon" style={{ backgroundColor: holdoverPartyInfo?.color || '#999' }}>{holdover_party}</span>
                            <span className="holdover-name">Sen. {holdover_senator}</span>
                        </a>
                    )}
                    <div>will represent the district as a holdover</div>
                </div>
            </div>
        </div>
        }
        <div className="candidates">
            {activeCandidates
                .map(c => <Candidate key={c.slug} {...c} />)}
        </div>

        {(inactiveCandidates.length > 0) && <details>
            <summary>Candidates defeated in June 2 primary election or who withdrew post-primary</summary>
            <div>
                {inactiveCandidates
                    .map(c => <Candidate key={c.slug} {...c} />)}
            </div>

        </details>}

    </div >

}



export default function LegislativeRaceOverview({ selHouseDistrict, selSenateDistrict }) {

    return <div css={legislativeOverviewStyle}>
        <div className="col house">
            {selHouseDistrict && <District {...selHouseDistrict} />}
        </div>
        <div className="col senate">
            {selSenateDistrict && <District {...selSenateDistrict} />}
        </div>

    </div >
}