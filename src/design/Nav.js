import { css } from '@emotion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'


const navContainerStyle = css`
    position: sticky;
    top: 0px;
    background-color: white;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.65rem 0;
    z-index: 1000;
`

const navStyle = css`
    border-bottom: 1px solid #444;
    margin-bottom: 0.5em;
    box-shadow: 0px 3px 3px -3px #000;
    width: 100%;
`
const navRowStyle = css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
`
const navRowPrimary = css`
    margin: 0 -0.25em; /* Aligns items to edges*/
`
const navRowSecondary = css`
    justify-content: center;
    font-size: 15px;
    gap: 0.25em;

    @media screen and (max-width: 600px) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch;
    }
`

const navItemStyle = css`
    
    
    margin: 0 0.25em;
    margin-bottom: 0.5rem;

    text-align: center;
    text-decoration: none;
    
    cursor: pointer;

    display: flex;
    justify-content: center;
    align-items: center;
    padding-top: 0.3em;
    padding-bottom: 0.3em;

    @media screen and (max-width: 600px) {
        margin: 0;
        width: 100%;
    }
`
const navPrimaryStyle = css`
    flex: 1 1 4em;
    padding: 0.2em;
    border: 1px solid #404040;
    background-color: #eee;
    box-shadow: 1px 1px 2px #ccc;
    display: flex;
    flex-direction: column;

    :hover {
        border: 1px solid #ce5a00;
        /* background-color: #f8f8f8; */
        text-decoration: none;
        box-shadow: 1px 1px 2px #666;
    }
`
const navPrimaryTitle = css`
    font-weight: bold;
    text-transform: uppercase;
    font-size: 1.1em;
    margin: 0.2em 0;

    @media screen and (max-width: 400px) {
        font-size: 13px;
    }
`
const navPrimaryInfo = css`
    color: #666;
    font-size: 0.8em;
    /* font-weight: bold; */
`
const navSecondaryStyle = css`
    flex: 1 1 10em;
    max-width: 14em;
    display: block;
    border: 1px solid var(--gray2);
    padding: 0.2em 0.5em;
    
    margin: 0em 0.25em;
    margin-bottom: 0.25em;

    @media screen and (max-width: 600px) {
        flex: initial;
        width: 100%;
        max-width: none;
        min-width: 0;
    }
`

const navSecondaryFirstFullStyle = css`
    @media screen and (max-width: 600px) {
        grid-column: 1 / -1;
    }
`

const activeStyle = css`
    background: var(--gray1);
    border: 1px solid var(--gray2);
`

// TODO - figure out how to flow this elegantly from race data
// Will need to shuffle some races into a 'more things' column
// Hover drop downs with each active candidate name
const PAGE_LINKS = [
    { path: '/', label: 'All Races' },
    { path: '/#federal-delegation', label: 'Federal Delegation' },
    // { path: '/#state-officials', label: 'State Officials' },
    { path: '/#legislature', label: 'Montana Legislature' },
    { path: '/#montana-supreme-court', label: 'Other offices' },
// TODO: Enable once we have ballot initiatives
    // { path: '/#ballot-initiatives', label: 'Ballot Initiatives' },
    { path: '/#voter-faq', label: 'Voting info' },
]

const Nav = ({ location }) => {
    // const currentPath = `${location.pathname}${location.hash}`
    // const isActiveStyle = (currentPath === l.path) ? activeStyle : null]
    const isActiveStyle = null
    const hasOddCount = PAGE_LINKS.length % 2 === 1
    const pathname = usePathname()

    const links = PAGE_LINKS.map((l, i) => {
        const firstFullStyle = (hasOddCount && i === 0) ? navSecondaryFirstFullStyle : null
        const handleClick = (l.path === '/' && pathname === '/') ? (e) => {
            e.preventDefault()
            window.history.replaceState(null, '', '/election-guide-2026/')
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } : undefined
        return <Link key={l.path} css={[navItemStyle, navSecondaryStyle, firstFullStyle, isActiveStyle]} href={l.path} onClick={handleClick}>{l.label}</Link>
    })

    return <div css={navContainerStyle}>
        <div css={navStyle}>
            <div css={[navRowStyle, navRowSecondary]}>
                {links}
            </div>

            {/* < div css={[navRowStyle, navRowPrimary]} >
                <Link css={[navItemStyle, navPrimaryStyle]} href='/house'>
                    <div css={navPrimaryTitle}>🏛 House</div>
                    <div css={navPrimaryInfo}>GOP-held 68-32</div>
                </Link>
                <Link css={[navItemStyle, navPrimaryStyle]} href='/senate'>
                    <div css={navPrimaryTitle}>🏛 Senate</div>
                    <div css={navPrimaryInfo}>GOP-held 34-16</div>
                </Link>
                <Link css={[navItemStyle, navPrimaryStyle]} href='/governor'>
                    <div css={navPrimaryTitle}>🖋 Governor</div>
                    <div css={navPrimaryInfo}>Greg Gianforte (R)</div>
                </Link>
            </div > */}
        </div >
    </div>
}

export default Nav

