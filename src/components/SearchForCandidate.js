import { useState, useMemo } from "react";
import { css } from "@emotion/react";
import Link from "next/link";

import { PARTIES, PARTIES_BY_KEY, STATUS } from "@/lib/styles";

const STATUS_BY_KEY = new Map(STATUS.map(s => [s.key, s]))

const lookupStyle = css`
    border: 1px solid var(--gray6);
    background-color: var(--gray1);
    padding: 1em;

    margin-bottom: 1em;

    .ledein {
        font-weight: bold;
        text-transform: uppercase;
    }

    form {
        display: flex;
        flex-wrap: wrap;
        margin-top: 0.5em;
        margin-bottom: 1em;
        
    }

    input {
        margin: -1px;
        flex: 4 1 15rem;
        height: 2em;
        padding: 0.25em;
    }

    button {
        margin: -1px;
        flex: 1 1 auto;
        background-color: var(--tan5);
        color: white;
        font-weight: normal;
    }
    button:hover {
        background-color: var(--link);
    }

`

const candidateStyle = css`
    margin: 0.5em auto;
    margin-top: 0.5em;
    border: 1px solid var(--tan5);
    box-shadow: 2px 2px 3px #aaa;
    max-width: 400px;
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
        font-size: 1.2em;
        margin-bottom: 0;
        font-weight: bold;
        text-transform: uppercase;
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
    .position {
        /* font-weight: bold; */
    }
    .status {
        /* color: white; */
        margin: 0.3em 0;
        background: var(--tan2);
        border: 1px solid var(--tan4);
        padding: 0.5em 0.5em;
        width: 100%
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

const PLACEHOLDER = 'Enter candidate (e.g., Greg Gianforte)'

function Candidate(props) {
    const { slug, path, displayName, party, status, race,
        summaryLine, cap_tracker_2025_link, hasResponses, numMTFParticles } = props
    // cap_tracker_2025_link flags for current lawmakers
    const partyInfo = PARTIES_BY_KEY.get(party)
    const statusInfo = STATUS_BY_KEY.get(status)
    return <div css={candidateStyle} style={{ borderTop: `3px solid ${partyInfo.color}` }}><Link href={`/${path}/${slug}`}>
        <div className="portrait-col" >
            <div className="party" style={{ background: partyInfo.color }}>{party}</div>
        </div>
        <div className="info-col">
            <div>
                <div className="name">{displayName}</div>
                {summaryLine && <div className="current">{summaryLine}</div>}
                {cap_tracker_2025_link && <div className="current">Sitting lawmaker</div>}
                <div className="position"><span style={{ color: partyInfo.color }}>{partyInfo.noun}</span> for {race}</div>
                <div className="status">{statusInfo.label}</div>

                <div className="tag-line">
                    {hasResponses && <span className="tag">✏️ Candidate Q&A</span>}
                    {(numMTFParticles > 0) && <span className="tag">📰 <strong>{numMTFParticles}</strong> {(numMTFParticles === 1) ? 'article' : 'articles'}</span>}
                </div>
            </div>

            <div className="fakelink">See more »</div>
        </div>
    </Link ></div >
}

export default function SearchForCandidate({
    candidates,
}) {
    const [searchText, setSearchText] = useState('')

    const matchingCandidates = useMemo(() => {
        if (!searchText || searchText.length < 3) return []
        const q = searchText.toUpperCase()
        return candidates
            .filter(d => d.displayName.toUpperCase().includes(q))
            .slice(0, 5)
    }, [searchText, candidates])

    function handleChange(event) {
        const input = event.target.value
        setSearchText(input)
    }

    return <div css={lookupStyle}>
        <div className="ledein">Search 2024 Montana candidates by name</div>
        <div className="note">This guide includes federal, state-level and legislative candidates. County commissioners and other local positions are excluded.</div>
        <form>
            <input onChange={handleChange} type="text" value={searchText} placeholder={PLACEHOLDER} />
        </form>
        <div>
            {
                matchingCandidates.map(c => <Candidate key={c.slug} {...c} />)
            }
        </div>
    </div>
}