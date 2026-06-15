import React, { useMemo, useEffect, useState } from 'react'
import { css } from "@emotion/react";
import dynamic from 'next/dynamic'

import Layout from '../design/Layout'
import LowdownCTA from '../design/LowdownCTA'
import CapitolizedCTA from '../design/CapitolizedCTA'
import Link from 'next/link';

import Markdown from 'react-markdown'

import SearchForCandidate from '../components/SearchForCandidate'
import MajorRaceOverview from '../components/majorRaceOverview'
import DeferredSection from '../components/DeferredSection'

import { urlize } from '../lib/utils'
import {
    getRaceOverviews,
    getOverviewText,
    getBallotIssues,
    getLegislativeDistrictOverviews,
    getHowToVoteText,
    getFullCandidateList,
} from '../lib/overview'
import { hasPortrait } from '../lib/portraits'

const DeferredAddressLookup = dynamic(() => import('../components/AddressLookup'))
const DeferredMajorRaceOverview = dynamic(() => import('../components/majorRaceOverview'))
const DeferredLegislativeRaceOverview = dynamic(() => import('../components/LegislativeRaceOverview'))
const DeferredLegislativeDistrictSelector = dynamic(() => import('../components/LegislativeDistrictSelector'))

const RACE_LEVELS = [
    'Federal Delegation',
    // 'State Officials',
    'Montana Supreme Court',
    'Public Service Commission'
]

const overviewStyles = css`
    --section-inline-padding: clamp(0.35rem, 2vw, 0.75rem);

    section {
        display: block;
        padding: 0 var(--section-inline-padding);
    }

    h2 {
        text-align: center;
        padding: 0.3em 0.5em;
        padding-bottom: 0.2em;
        background-color: var(--tan2);
        color: var(--tan6);
        border-top: 4px solid var(--tan5);
        font-weight: normal;
        text-transform: uppercase;
        margin-bottom: 1em;
        margin-top: 1em;
        margin-left: 0;
        margin-right: 0;
    }
    h3 {
        text-align: center;
        margin-top: 0.2em;
        background-color: var(--tan6);
        padding: 0.3em 0.5em;
        color: white;
        text-transform: uppercase;
    }

    .deferred-content {
        content-visibility: auto;
        contain-intrinsic-size: 900px;
    }
`



export async function getStaticProps() {
    const races = getRaceOverviews().map(race => ({
        ...race,
        candidates: race.candidates.map(c => ({ ...c, hasPortrait: hasPortrait(c.slug) })),
        inactiveCandidates: race.inactiveCandidates.map(c => ({ ...c, hasPortrait: hasPortrait(c.slug) })),
    }))
    const legislativeRaces = getLegislativeDistrictOverviews()
    const text = getOverviewText()
    const ballotIssues = getBallotIssues()
    const votingFAQ = getHowToVoteText()
    const fullCandidateList = getFullCandidateList()
    return {
        props: {
            races,
            legislativeRaces,
            ballotIssues,
            text,
            votingFAQ,
            fullCandidateList
        }
    }
}

export default function Home({ races, legislativeRaces, ballotIssues, text, votingFAQ, fullCandidateList }) {

    // State for filtering overview to candidates for a given voter address
    // Design approach here is to make this optional for readers who won't engage with interactivity
    const [selDistricts, setSelDistricts] = React.useState({
        usHouse: null, // 'us-house-1' or 'us-house-2'
        psc: null, // 'psc-2','psc-3','psc-4'
        mtHouse: 'HD-1', // e.g. 'HD-1',
        mtSenate: 'SD-1', // e.g. 'SD-1'
        matchedAddress: null
    })

    const [showLowdown, setShowLowdown] = useState(null);

    useEffect(() => {
        setShowLowdown(Math.random() < 0.5);
    }, []);


    const {
        overviewLedeIn,
        overviewBallotInitiatives,
        overviewLegislatureLedeIn,
        overviewAlsoOnYourBallot,
        overviewAboutThisProject,
    } = text

    const raceLevels = useMemo(() => {
        const byLevel = new Map(RACE_LEVELS.map(level => [level, []]))

        races.forEach(r => {
            if (r.category === 'us-house' && selDistricts.usHouse !== null && selDistricts.usHouse !== r.raceSlug) {
                return
            }
            if (r.category === 'psc' && selDistricts.psc !== null && selDistricts.psc !== r.raceSlug) {
                return
            }
            if (byLevel.has(r.level)) {
                byLevel.get(r.level).push(r)
            }
        })

        return RACE_LEVELS.map(level => ({
            level,
            races: byLevel.get(level) || [],
        }))
    }, [races, selDistricts.usHouse, selDistricts.psc])

    const houseDistrictOptions = useMemo(
        () => legislativeRaces.filter(d => d.chamber === 'house').map(d => d.districtKey),
        [legislativeRaces]
    )

    const senateDistrictOptions = useMemo(
        () => legislativeRaces.filter(d => d.chamber === 'senate').map(d => d.districtKey),
        [legislativeRaces]
    )

    const legislativeRacesByKey = useMemo(
        () => new Map(legislativeRaces.map(d => [d.districtKey, d])),
        [legislativeRaces]
    )
    const selHouseDistrict = legislativeRacesByKey.get(selDistricts.mtHouse) ?? null
    const selSenateDistrict = legislativeRacesByKey.get(selDistricts.mtSenate) ?? null
    const pageDescription = "Candidates seeking state, federal and legislative office in Montana's 2026 elections. The Montana Free press voter guide includes biographical details and issue questionnaires."
    return (
        <Layout home pageCss={overviewStyles}
            relativePath='/'
            pageTitle={"Montana's 2026 Candidates | 2026 Montana Election Guide"}
            pageDescription={pageDescription}
            siteSeoTitle={"Montana's 2026 Candidates | 2026 MTFP Election Guide"}
            seoDescription={pageDescription}
            socialTitle={"The MTFP 2026 Election Guide"}
            socialDescription={"Federal, state and legislative candidates seeking Montana office in 2026."}
        >

            <Markdown>{overviewLedeIn}</Markdown>

            <SearchForCandidate candidates={fullCandidateList} legislativeRaces={legislativeRaces} selDistricts={selDistricts} setSelDistricts={setSelDistricts} />

            <DeferredSection className="deferred-content" minHeight={230} idleTimeout={800} rootMargin="260px 0px">
                <DeferredAddressLookup selDistricts={selDistricts} setSelDistricts={setSelDistricts} legislativeRaces={legislativeRaces} races={races} />
            </DeferredSection>


            <section>
                <div>
                    {raceLevels.slice(0, 1).map(rl => {
                        return <div key={rl.level}>
                            <a className="link-anchor" id={urlize(rl.level)}></a>
                            <h2>{rl.level}</h2>
                            {
                                rl.races
                                    .map(r => <MajorRaceOverview key={r.raceSlug}
                                        race={r}
                                        showMap={['Federal Delegation', 'Public Service Commission'].includes(r.level)}
                                    />)
                            }
                        </div>
                    })}
                </div>
            </section>
            <hr />

            {showLowdown === true && <LowdownCTA />}
            {showLowdown === false && <CapitolizedCTA />}



            <DeferredSection className="deferred-content" minHeight={760} idleTimeout={1200}>
                <section>
                    <a className="link-anchor" id="legislature"></a>
                    <a className="link-anchor" id="montana-legislature"></a>
                    <h2>Montana State Legislature</h2>
                    <Markdown>{overviewLegislatureLedeIn}</Markdown>
                    <DeferredLegislativeDistrictSelector
                        houseDistrictOptions={houseDistrictOptions}
                        senateDistrictOptions={senateDistrictOptions}
                        selHd={selDistricts.mtHouse}
                        selSd={selDistricts.mtSenate}
                        setLegislativeDistricts={(mtHouse, mtSenate) => {
                            setSelDistricts({
                                ...selDistricts,
                                mtHouse,
                                mtSenate,
                            })
                        }}
                    />
                    <DeferredLegislativeRaceOverview
                        selHouseDistrict={selHouseDistrict}
                        selSenateDistrict={selSenateDistrict}
                    />
                    <div className="note-row">
                        <div className='note'>
                            <Link href="/legislative-candidates-by-district/">See all candidates listed by district.</Link>
                        </div>
                        <div className='note2'>
                            <span><span style={{ fontSize: '1.8em', verticalAlign: 'text-bottom' }}>*</span>Denotes incumbent candidate</span>
                        </div>
                    </div>
                </section>
            </DeferredSection>

            <DeferredSection className="deferred-content" minHeight={1100} idleTimeout={1500}>
                <section>
                    <div>
                        {raceLevels.slice(1,).map(rl => {
                            return <div key={rl.level}>
                                <a className="link-anchor" id={urlize(rl.level)}></a>
                                <h2>{rl.level}</h2>
                                {
                                    rl.races.map(r => <DeferredMajorRaceOverview key={r.raceSlug}
                                        race={r}
                                        showMap={['Federal Delegation', 'Public Service Commission'].includes(r.level)}
                                    />)
                                }
                            </div>
                        })}
                    </div>
                </section>
            </DeferredSection>
            <hr />

            {/* TODO: Enable once we have ballot initiatives */}
            {/* <section>
                <a className="link-anchor" id="ballot-initiatives"></a>
                <h2>Ballot initiatives</h2>
                <Markdown>{overviewBallotInitiatives}</Markdown>
                <BallotInitiativeOverview ballotIssues={ballotIssues} />
            </section> */}
            {/* TODO: Enable for general */}
            <DeferredSection className="deferred-content" minHeight={700} idleTimeout={1800}>
                <section>
                    <h2>Other ballot items</h2>
                    <Markdown>{overviewAlsoOnYourBallot}</Markdown>
                </section>

                <section>
                    <a className="link-anchor" id="voter-faq"></a>
                    <h2>Common Voting Questions</h2>
                    <Markdown>{votingFAQ}</Markdown>
                </section>

                <section>
                    <a className="link-anchor" id="about"></a>
                    <h2>About this project</h2>
                    <Markdown>{overviewAboutThisProject}</Markdown>
                </section>
            </DeferredSection>

        </Layout >
    );
}