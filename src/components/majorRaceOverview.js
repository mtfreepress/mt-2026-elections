import { css } from "@emotion/react";

import { useRouter } from 'next/router';


import Link from 'next/link'
import Image from 'next/image'

import { PARTIES, PARTIES_BY_KEY } from '../lib/styles'
import { pluralize } from '../lib/utils'

const raceStyle = css`
    margin-bottom: 2em;

    .map-row {
        display: flex;
        justify-content: center;
        margin-top: 1em;
        margin-bottom: 1em;
    }

    .map-container {
        max-width: 600px;
        
    }

    .party-buckets {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-around;
        margin-top: 0.5em;
        gap: 0.5em;
     }
    .party-bucket {
        flex: 1 1 280px;
        min-width: min(100%, 280px);
        padding: 0 0.5em;
        h4 {
            margin: 0;
            text-transform: uppercase;
        }
        border-left: 3px solid gray;    
        margin-bottom: 1em;
    }

    @media screen and (max-width: 700px) {
        .party-buckets {
            justify-content: center;
            margin-left: 5%;
        }

        .party-bucket {
            flex: 1 1 100%;
            max-width: 360px;
            margin-left: auto;
            margin-right: auto;
            padding: 0;
        }

        .party-bucket h4 {
            text-align: center;
        }
    }
`
const candidateStyle = css`
    margin: 0.5em 0;
    width: min(100%, 310px);
    a {
        width: 100%;
        display: flex;
        align-items: stretch;
        background-color: var(--tan1);
        box-shadow: 2px 2px 3px #aaa;
        color: black;
        min-width: 0;
    }
    a:hover {
        opacity: 0.8;
        text-decoration: none;
        /* border: 2px solid black; */
        color: var(--link);
    }
    
    .portrait-col {
        flex: 0 0 100px;
    }
    .portrait-container {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        overflow: hidden;
        background-color: #666;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
    }
    .info-col {
        flex: 1 1 200px;
        padding: 0.5em 0.5em;
        position: relative;
        min-width: 0;
       
    }
    .name {
        font-weight: bold;
        font-size: 1.2em;
    }
    .tag-line {
        font-size: 0.8em;
        margin-top: 0.3em;
    }
    .tag {
        /* display: inline-block; */
        /* border: 1px solid var(--tan4); */
        /* padding: 0.2em 0.5em; */
        margin-right: 0.5em;
    }
    .tag:not(:last-child):after {
        /* content: '•' */
    }
    .summary-line {
        font-style: italic;
        font-size: 0.9em;
    }
    .fakelink {
        position: absolute;
        bottom: 3px;
        right: 8px;
        color: var(--tan5);
        font-size: 0.9em;
    }

    @media screen and (max-width: 400px) {
        .portrait-col {
            flex: 0 0 84px;
        }

        .portrait-container {
            width: 84px;
            height: 84px;
        }

        .name {
            font-size: 1.05em;
        }

        .fakelink {
            position: static;
            margin-top: 0.35em;
        }
    }
`

function Candidate(props) {
    const { slug, displayName, summaryLine, party, numMTFParticles, hasResponses, hasPortrait, raceSlug } = props
    const partyInfo = PARTIES_BY_KEY.get(party)
    const router = useRouter()
    const portraitSrc = hasPortrait
        ? `${router.basePath}/portraits/${slug}.webp`
        : `${router.basePath}/portraits/no-match.webp`

    return <div css={candidateStyle} style={{ borderTop: `5px solid ${partyInfo.color}` }}><Link href={`/candidates/${slug}`}>
        <div className="portrait-col" >
            <div className="portrait-container">
                <Image
                    alt={`${displayName}`}
                    src={portraitSrc}
                    width={100}
                    height={100}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            </div>
        </div>
        <div className="info-col">
            <div className="name">{displayName}</div>
            <div className="summary-line">{summaryLine}</div>
            <div className="tag-line">
                {hasResponses && <span className="tag">✏️ Candidate Q&A</span>}
                {!hasResponses && !raceSlug.includes('supco') && <span className="tag">🚫 No Q&A response</span>}
                {(numMTFParticles > 0) && <span className="tag">📰 <strong>{numMTFParticles}</strong> {(numMTFParticles === 1) ? 'article' : 'articles'}</span>}
            </div>
            <div className="fakelink">
                <span>See more »</span>
            </div>
        </div>
    </Link ></div >
}

export default function MajorRaceOverview({ race, showMap }) {
    const {
        raceSlug,
        displayName,
        description,
        candidates,
        inactiveCandidates,
        note,
    } = race

    let mapPath = null
    const router = useRouter()
    if (showMap) {
        mapPath = `${router.basePath}/maps/${raceSlug}.webp`
    }


    return <div key={raceSlug} css={raceStyle}>
        <a className="link-anchor" id={raceSlug}></a>
        <h3>{displayName}</h3>
        <div className="description">{description}</div>
        {showMap && <div className="map-row">
            <div className="map-container">
                <Image
                    alt={`Map of ${displayName}`}
                    src={mapPath}
                    // TODO: Decide if eager makes sense or if there's a way to just load the visible map without eager-loading all maps
                    // loading="eager"
                    width={1200}
                    height={800}
                    style={{
                        width: '100%',
                        height: 'auto',
                    }}
                />
            </div>
        </div>}
        {(() => {
            const activeBuckets = PARTIES.filter(party => candidates.some(d => d.party === party.key))
            const isSingleParty = activeBuckets.length === 1
            return <div className="party-buckets">
                {isSingleParty
                    ? candidates.map(d => <Candidate key={d.slug} {...d} />)
                    : PARTIES.map(party => {
                        const candidatesInBucket = candidates.filter(d => d.party === party.key)
                        if (candidatesInBucket.length === 0) return null
                        return <div className="party-bucket" key={party.key} style={{ borderLeft: `3px solid ${party.color}` }}>
                            <h4 style={{ color: party.color }}>{pluralize(party.noun, candidatesInBucket.length)}</h4>
                            <div>{candidatesInBucket.map(d => <Candidate key={d.slug} {...d} />)}</div>
                        </div>
                    })
                }
            </div>
        })()}
        {
            (inactiveCandidates.length > 0) && <details>
                <summary>Candidates defeated in June 2 primary election</summary>
                {(() => {
                    const activeInactiveBuckets = PARTIES.filter(party => inactiveCandidates.some(d => d.party === party.key))
                    const isSingleParty = activeInactiveBuckets.length === 1
                    return <div className="party-buckets">
                        {isSingleParty
                            ? inactiveCandidates.map(d => <Candidate key={d.slug} {...d} />)
                            : PARTIES.map(party => {
                                const candidatesInBucket = inactiveCandidates.filter(d => d.party === party.key)
                                if (candidatesInBucket.length === 0) return null
                                return <div className="party-bucket" key={party.key} style={{ borderLeft: `3px solid ${party.color}` }}>
                                    <h4 style={{ color: party.color }}>{pluralize(party.noun, candidatesInBucket.length)}</h4>
                                    <div>{candidatesInBucket.map(d => <Candidate key={d.slug} {...d} />)}</div>
                                </div>
                            })
                        }
                    </div>
                })()}
            </details>
        }

        <div className="note">{note}</div>
    </div>
}