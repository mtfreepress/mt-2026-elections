import { css } from "@emotion/react";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from 'next/router';

import { PARTIES, PARTIES_BY_KEY } from "@/lib/styles";
import { pluralize } from "@/lib/utils";

const opponentsContainerStyle = css`
    border: 1px solid var(--gray2);
    padding: .5em;
    margin-bottom: 0.5em;

    h4 {
        margin-top: 0;
        margin-left: .2em;
    }
    .party-buckets {
        display: flex;
        flex-wrap: wrap;
        margin-top: .8em;
        /* Note RE justifyy-content: what works well for 4x-party races doesn't work for two-party races */
        justify-content: space-around;
     }
    .party-bucket {
        flex: 1 0 100px;
        h4 {
            margin: 0;
            text-transform: uppercase;
            text-align: center;
        }
        margin-bottom: .8em;
        margin-right: .5em;
        margin-left: .5em;
    } 
        .note {
            font-size: 1em;
            margin-left: .3em;

`

const candidateStyle = css`
    flex: 1 0 140px;
    margin: 0.5em auto;
    max-width: 220px;
    /* width: 140px; */
    a {
        
        height: 40px;
        display: flex;
        align-items: stretch;
        background-color: var(--tan1);
        box-shadow: 2px 2px 3px #aaa;
        color: black;
    }
    a:hover {
        opacity: 0.8;
        text-decoration: none;
        /* border: 2px solid black; */
        color: var(--link);
    }
    .portrait-col {
        flex: 0 0 40px;
    }
    .portrait-container {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;
        background-color: #666;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
    }
    .party {
        width: 40px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.2em;
        color: white;
    }
    .info-col {
        flex: 1 1 120px;
        padding: 0.5em 0.5em;
        position: relative;

        display: flex;
        align-items: center;
    }
    .name {
        font-size: 1em;
        margin-bottom: 0;
        width: 100%;
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
    const { slug, displayName, summaryLine, party, route, isCurrentPage, hasPortraits, hasPortrait } = props
    const partyInfo = PARTIES_BY_KEY.get(party)
    const router = useRouter()
    const portraitSrc = hasPortrait
        ? `${router.basePath}/portraits/${slug}.webp`
        : `${router.basePath}/portraits/no-match.webp`
    return <div css={candidateStyle}
        style={{
            borderTop: `3px solid ${partyInfo.color}`,
            fontWeight: isCurrentPage ? 'bold' : null,
        }}
    >
        <Link href={`/${route}/${slug}`}>
            <div className="portrait-col">
                {hasPortraits && <div className="portrait-container">
                    <Image
                        alt={`${displayName}`}
                        src={portraitSrc}
                        width={40}
                        height={40}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </div>}
                {!hasPortraits && <div className="party" style={{ background: partyInfo.color }}>{party}</div>}
            </div>
            <div className="info-col">
                <div className="name">{displayName}</div>
                {/* <div className="summary-line">{summaryLine}</div> */}
            </div>
        </Link >
    </div >
}

export default function CandidatePageOpponents({
    opponents,
    // candidateParty,
    route,
    raceDisplayName,
    currentPage,
    hasPortraits
}) {
    return <div css={opponentsContainerStyle}>
        <h4>Active candidates for {raceDisplayName}</h4>
        <div className="note">Republican, Democratic, and Libertarian general election nominees will be selected via the June 2, 2026, primary election. Independent candidates are currently gathering signatures in an attempt to qualify for the general election ballot. Independent candidates do not participate in primary elections. </div>
        {(() => {
            const activeBuckets = PARTIES.filter(party => opponents.some(d => d.party === party.key))
            const isSingleParty = activeBuckets.length === 1
            return <div className="party-buckets">
                {isSingleParty
                    ? opponents.map(d => <Candidate key={d.slug} {...d} hasPortraits={hasPortraits} route={route} isCurrentPage={currentPage === d.slug} />)
                    : PARTIES.map(party => {
                        const opponentsInParty = opponents.filter(d => d.party === party.key)
                        if (opponentsInParty.length === 0) return null
                        return <div className="party-bucket" key={party.key} style={{ borderLeft: `px solid ${party.color}` }}>
                            <h4 style={{ color: party.color }}>{pluralize(party.noun, opponentsInParty.length)}</h4>
                            <div className="party-list">{opponentsInParty.map(d => <Candidate key={d.slug} {...d} hasPortraits={hasPortraits}
                                route={route}
                                isCurrentPage={currentPage === d.slug}
                            />)}</div>
                        </div>
                    })
                }
            </div>
        })()}

    </div>
}