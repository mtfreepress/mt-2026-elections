import React from 'react'
import { css } from "@emotion/react";

import Layout from '../design/Layout'

import Markdown from 'react-markdown'

import LegislativeRaceOverview from '../components/LegislativeRaceOverview'

import { getCorrespondingSenateDistrictNumber } from '../lib/utils'
import {
    getRaceOverviews,
    getOverviewText,
    getBallotIssues,
    getLegislativeDistrictOverviews,
    getHowToVoteText,
} from '../lib/overview'


const overviewStyles = css`
    section {
        display: block;
        padding: 0 0.5em;
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
        margin-left: -1em;
        margin-right: -1em;
    }
    h3 {
        text-align: center;
        margin-top: 0.2em;
        background-color: var(--tan6);
        padding: 0.3em 0.5em;
        color: white;
        text-transform: uppercase;
    }
`

export async function getStaticProps() {
    const races = getRaceOverviews()
    const legislativeRaces = getLegislativeDistrictOverviews()
    const text = getOverviewText()
    const ballotIssues = getBallotIssues()
    const votingFAQ = getHowToVoteText()
    return {
        props: {
            races,
            legislativeRaces,
            ballotIssues,
            text,
            votingFAQ,
        }
    }
}

export default function LegislativeCandidatesByDistrict({ legislativeRaces, text, }) {
    const {
        overviewLegislatureLedeIn,
        overviewAboutThisProject,
    } = text

    const districts = legislativeRaces.filter(d => d.chamber === 'house')
        .map(hd => {
            const correspondingSDKey = `SD-${getCorrespondingSenateDistrictNumber(hd.districtKey)}`
            const sd = legislativeRaces.find(d => d.districtKey === correspondingSDKey)
            return { hd, sd }
        })
    const pageDescription = "Candidates running for the Montana State Legislature in 2026 by district, including Republican and Democratic candidates."
    return (
        <Layout home pageCss={overviewStyles}
            relativePath='/'
            pageTitle={"Montana's 2026 Legislative Candidates | 2026 Montana Election Guide"}
            pageDescription={pageDescription}
            siteSeoTitle={"Montana's 2026 Legislative Candidates | 2026 Montana Election Guide"}
            seoDescription={pageDescription}
            socialTitle={"The MTFP 2026 Election Guide: Candidates for Montana Legislature"}
            socialDescription={pageDescription}
        >

            <h1>2026 CANDIDATES FOR MONTANA LEGISLATURE</h1>

            <section>
                <a className="link-anchor" id="legislature"></a>
                <Markdown>{overviewLegislatureLedeIn}</Markdown>
                {
                    districts.map((district, i) => <div key={district.hd.districtKey}>
                        <LegislativeRaceOverview
                            selHouseDistrict={(i % 2 == 0) ? district.sd : null}
                            selSenateDistrict={district.hd}
                        />
                        {(i % 2 == 1) && <hr />}
                    </div>)
                }
            </section>

            <section>
                <a className="link-anchor" id="about"></a>
                <h2>About this project</h2>
                <Markdown>{overviewAboutThisProject}</Markdown>
            </section>

        </Layout >
    );
}