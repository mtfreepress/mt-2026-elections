
import { css } from '@emotion/react'

import Link from 'next/link'
import Markdown from 'react-markdown'

import Layout from '../../design/Layout'
import LowdownCTA from '../../design/LowdownCTA'

import CandidatePageSummary from '../../components/CandidatePageSummary'
import CandidateWebLinks from '../../components/CandidateWebLinks'
import CandidatePageOpponents from '../../components/CandidatePageOpponents'
import RaceFinance from '../../components/RaceFinance'
import CandidateQuestionnaire from '../../components/CandidateQuestionnaire'
import LinksList from '../../components/LinksList'
import RaceResults from '../../components/RaceResults'

import text from '../../data/text'


import { getHowToVoteText } from '../../lib/overview'
import { getAllCandidateIds, getCandidateData } from '../../lib/candidates';
import { hasPortrait } from '../../lib/portraits'

const { questionnaireStateOfficeLedein, overviewAboutThisProject } = text

const candidatePageStyle = css`
    h2 {
        text-transform: uppercase;
        text-align: center;
        padding: 0.3em 0.5em;
        background-color: var(--tan6);
        color: white;
    }

    /* Moving down into component */
    /* .race-candidates {
        border: 1px solid var(--gray2);
        padding: 0.5em;

        h4 {
            margin-top: 0;
        }
    } */


    .link-block {
        margin: 0.5em 0;

        span:not(:last-child):after{
            content: ' • '
        }
    }
`

export async function getStaticPaths() {
    // Define routes that should be used for /[candidate] pages
    const slugs = getAllCandidateIds() // Array of URL-friendly slugs
    return {
        paths: slugs.map(d => ({ params: { candidate: d } })),
        fallback: false,
    }
}

export async function getStaticProps({ params }) {
    // Populate page props
    const pageData = getCandidateData(params.candidate)
    const votingFAQ = getHowToVoteText()
    pageData.hasPortrait = hasPortrait(pageData.slug)
    if (pageData.opponents) {
        pageData.opponents = pageData.opponents.map(o => ({ ...o, hasPortrait: hasPortrait(o.slug) }))
    }
    return {
        props: {
            pageData,
            votingFAQ,
        }
    }
}

export default function CandidatePage({ pageData, votingFAQ }) {
    const {
        slug,
        party,
        displayName,
        lastName,
        summaryNarrative,
        opponents,
        questionnaire,
        finance,
        coverage,
        raceSlug,
        raceDisplayName,
        primaryResults
    } = pageData
    const pageDescription = `${displayName} (${party}) is running as a candidate for ${raceDisplayName} in Montana's 2026 election. See biographic details, issue positions and information on how to vote.`
    return (
        <Layout pageCss={candidatePageStyle}
            relativePath={slug}
            pageTitle={`${displayName} | ${raceDisplayName} | 2026 Montana Election Guide`}
            pageDescription={pageDescription}
            siteSeoTitle={`${displayName} | ${raceDisplayName} | 2026 Montana Election Guide`}
            seoDescription={pageDescription}
            socialTitle={`${displayName} | 2026 Montana Free Press Election Guide`}
            socialDescription={`Candidate for ${raceDisplayName}.`}
        >
            <CandidatePageSummary {...pageData} />
            <div className="link-block">
                {/* <Link href="#opponents">Opponents</Link> */}
                <span><Link href="#bio">About {lastName}</Link></span>
                <span><Link href="#issues">On the issues</Link></span>
                <span><Link href="#coverage">{lastName} in MTFP coverage</Link></span>
                <span><Link href="#results">Election results</Link></span>
                <span><Link href="#voting-faq">Voting in Montana</Link></span>
                <span><Link href="#about">About this project</Link></span>
            </div>

            <section id="opponents" className="race-candidates">
                <CandidatePageOpponents
                    opponents={opponents} candidateParty={party}
                    route='candidates'
                    raceDisplayName={raceDisplayName}
                    currentPage={slug}
                    hasPortraits={true}
                />
            </section>



            {/* NARRATIVE SECTION */}
            <a className="link-anchor" id="bio"></a>
            <section>
                <Markdown>{summaryNarrative}</Markdown>
                <CandidateWebLinks {...pageData} />
            </section>

            <LowdownCTA />

            {/* QUESTIONNAIRE RESPONSES */}
            <a className="link-anchor" id="issues"></a>
            <section>
                <h2>ON THE ISSUES</h2>
                <Markdown>{questionnaireStateOfficeLedein}</Markdown>
                {questionnaire ?
                    <CandidateQuestionnaire
                        responses={questionnaire.responses}
                        displayName={displayName}
                        currentCandidateSlug={slug}
                        opponents={opponents}
                    /> :
                    <div className="note">No responses at this time.</div>
                }
            </section>

            {/* MTFP COVERAGE */}
            <a className="link-anchor" id="coverage"></a>
            <section>
                <h2>MTFP COVERAGE OF {lastName}</h2>
                <LinksList articles={coverage} />
            </section>


            <section>
                <a className="link-anchor" id="finance"></a>
                <h2>CAMPAIGN FINANCE</h2>
                {/* <Markdown>{questionnaireStateOfficeLedein}</Markdown> */}
                {finance ?
                    <RaceFinance
                        finance={finance}
                        raceSlug={raceSlug}
                    /> :
                    <div className="note">Campaign finance information for non-federal candidates is publicly available through the state <a href="https://cers-ext.mt.gov/CampaignTracker/dashboard">Campaign Electronic Reporting System</a> maintained by the Montana Commissioner of Political Practices. MTFP isn&apos;t presenting that data on this guide at the current time because the COPP system doesn&apos;t make it possible to easily export reliable campaign finance summary data for the races that office oversees.</div>
                }
            </section>

{/* TODO: Add back after primary results are available */}
            {/* <section>
                <a className="link-anchor" id="results"></a>
                <h2>Election outcomes</h2>
                {
                    (party !== 'I') && primaryResults.resultsTotal && (primaryResults.resultsTotal.length > 0) ? <RaceResults
                        results={primaryResults}
                        primaryParty={party} // null for general elex results
                        title={`June 2 primary`}
                    />
                        : <p>No party primary was conducted.</p>
                }
            </section> */}

            <section>
                <a className="link-anchor" id="voting-faq"></a>
                <h2>COMMON VOTING QUESTIONS</h2>
                <Markdown>{votingFAQ}</Markdown>
            </section>

            <section>
                <a className="link-anchor" id="about"></a>
                <h2>About this project</h2>
                <Markdown>{overviewAboutThisProject}</Markdown>
            </section>

        </Layout>
    );
}