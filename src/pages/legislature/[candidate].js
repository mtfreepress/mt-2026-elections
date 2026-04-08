
import { css } from '@emotion/react'
import Link from 'next/link'
import Markdown from 'react-markdown'

import Layout from '../../design/Layout'
import LowdownCTA from '../../design/LowdownCTA'

import LegislativeCandidatePageSummary from '../../components/LegislativeCandidatePageSummary'
import CandidateWebLinks from '../../components/CandidateWebLinks'
import CandidatePageOpponents from '../../components/CandidatePageOpponents'
import CandidateQuestionnaire from '../../components/CandidateQuestionnaire'
import LinksList from '../../components/LinksList'
import RaceResults from '@/components/RaceResults'

import text from '../../data/text'
import { getAllCandidateIds, getCandidateData } from '../../lib/legislative-candidates'
import { getHowToVoteText } from '../../lib/overview'

const { questionnaireLegislatureLedein, overviewAboutThisProject } = text

const candidatePageStyle = css`
    h2 {
        text-transform: uppercase;
        text-align: center;
        padding: 0.3em 0.5em;
        background-color: var(--tan6);
        color: white;
    }


    .link-block {
        margin: 0.5em 0;

        a:not(:last-child):after{
            content: ' • '
        }
    }
`

export async function getStaticPaths() {
    // Define routes that should be used for /[legeCandidate] pages
    const slugs = getAllCandidateIds() // Array of URL-friendly slugs
    // const slugs = []
    return {
        paths: slugs.map(d => ({ params: { candidate: d } })),
        fallback: false,
    }
}

export async function getStaticProps({ params }) {
    // Populate page props
    const pageData = getCandidateData(params.candidate)
    const votingFAQ = getHowToVoteText()
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
        summaryNarrative,
        opponents,
        questionnaire,
        coverage,
        raceDisplayName,
        cap_tracker_2025_link,
        primaryResults,
    } = pageData
    const pageDescription = `${displayName} (${party}) is running as a candidate for ${raceDisplayName} in Montana's 2026 election. See biographic details, district boundaries and information on how to vote.`
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
            <LegislativeCandidatePageSummary {...pageData} />
            <div className="link-block">
                {/* <Link href="#opponents">Opponents</Link> */}
                <Link href="#issues">On the issues</Link>
                <Link href="#coverage">MTFP coverage</Link>
                {cap_tracker_2025_link && <Link href={cap_tracker_2025_link}> Legislative record via MTFP Capitol Tracker</Link>}
                <Link href="#results">Election results</Link>
                <Link href="#voting-faq">Voting in Montana</Link>
                <Link href="#about">About this project</Link>
            </div>

            <a className="link-anchor" id="opponents"></a>
            <section>
                <CandidatePageOpponents
                    opponents={opponents}
                    candidateParty={party}
                    route='legislature'
                    raceDisplayName={raceDisplayName}
                    currentPage={slug}

                />
            </section>
           



            {/* NARRATIVE SECTION */}
            <section>
                <Markdown>{summaryNarrative}</Markdown>
                {/* <CandidateWebLinks {...pageData} /> */}
            </section>

            <LowdownCTA />

            {/* QUESTIONNAIRE RESPONSES */}

            <a className="link-anchor" id="issues"></a>
            <section>
                <h2>ON THE ISSUES</h2>
                <Markdown>{questionnaireLegislatureLedein}</Markdown>
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
            <section id="coverage">
                <h2>MTFP COVERAGE</h2>
                <LinksList articles={coverage} />
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
                <h2>Common voting questions</h2>
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