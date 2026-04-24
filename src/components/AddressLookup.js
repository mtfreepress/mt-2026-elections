import { useState, useMemo, useEffect } from "react";
import { css } from "@emotion/react";
import { useRouter } from 'next/router';
import mapDistrictCode from "../lib/mapDistrictCode";
import DistrictFinder from '../lib/DistrictFinder';
import { PARTIES } from "@/lib/styles";

// Instantiated once at module level — class has no per-render state
const districtFinder = new DistrictFinder();

const ELECTION_MODE = process.env.ELECTION_MODE || 'primary';
const PLACEHOLDER = 'Enter address (e.g., 1301 E 6th Ave, Helena)';
const DEFAULT_MESSAGE = 'Look up districts for your address by entering it above.';
const MIN_SUGGEST_CHARS = 4;
const SUGGEST_DEBOUNCE_MS = 180;
const SUGGESTIONS_LIST_ID = 'mt-address-suggestions';
const SUGGESTION_OPTION_ID_PREFIX = 'mt-address-suggestion-option';

const resultsContainerStyle = css`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const headerStyle = css`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

    @media (max-width: 768px) {
        flex-direction: column;
        align-items: flex-start;
    }
`;

const headerTitleStyle = css`
    flex: 1;
    margin-right: 10px;

    @media (max-width: 768px) {
        width: 100%;
        margin-bottom: 10px;
    }
`;

const resetStyle = css`
    cursor: pointer;
    background: #737373;
    color: white;
    padding: 3px 10px;
    align-self: flex-end;
    transition: box-shadow 0.3s ease, background .3s ease;
    &:hover {
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
        background: var(--link);
        text-decoration: none;
    }
`;

const topRowStyle = css`
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
`;

const distResStyle = css`
    flex: 1 1 45%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 150px;
    max-width: 48%;
    padding: 10px;
    border: 1px solid var(--gray4);
    background-color: var(--gray0);
    text-align: center;
    box-sizing: border-box;
`;

const legeBlockStyle = css`
    border: 1px solid var(--tan5);
    background: white;
    padding: 0.75em;
    margin-top: 0.5em;

    h4 {
        margin: 0 0 0.5em 0;
        padding: 0.3em 0.5em;
        background-color: var(--tan6);
        color: white;
        text-transform: uppercase;
        font-size: 0.95em;
    }

    .party-group {
        margin-bottom: 0.5em;
    }
    .party-label {
        font-weight: bold;
        font-size: 0.9em;
        margin-bottom: 0.2em;
        padding-left: 0.25em;
    }
    .candidate-row {
        display: flex;
        align-items: center;
        padding: 0.3em 0.5em;
        font-size: 0.95em;
    }
    .candidate-row:not(:last-child) {
        border-bottom: 1px solid var(--gray1);
    }
    .candidate-name {
        margin-right: 0.5em;
    }
    .candidate-website a {
        color: var(--link);
        font-size: 0.85em;
    }
    .out-of-cycle {
        font-style: italic;
        color: var(--gray3);
        padding: 0.5em;
    }
`;

const errorStyle = css`
    background-color: #ffdddd;
    color: #d8000c;
    border: 1px solid #d8000c;
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: bold;
    display: flex;
    align-items: center;
    white-space: pre-wrap;
    svg {
        margin-right: 10px;
    }
`;

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

    .input-wrap {
        position: relative;
        flex: 4 1 15rem;
        min-width: 12rem;
    }

    .form-note {
        width: 100%;
        margin-top: 0.35em;
        font-size: 0.85em;
        color: var(--gray5);
    }

    input {
        margin: -1px;
        width: 100%;
        height: 2em;
        padding: 0.25em;
    }

    .suggestions-list {
        position: absolute;
        top: calc(100% + 2px);
        left: 0;
        right: 0;
        z-index: 5;
        margin: 0;
        padding: 0.25em 0;
        list-style: none;
        border: 1px solid var(--gray4);
        background: white;
        max-height: 14rem;
        overflow-y: auto;
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
        font-family: futura-pt, Arial, Helvetica, sans-serif;
    }

    .suggestion-item {
        padding: 0.45em 0.65em;
        cursor: pointer;
        color: var(--gray7);
        font-size: 0.95em;
        line-height: 1.25;
    }

    .suggestion-item + .suggestion-item {
        border-top: 1px solid var(--gray1);
    }

    .suggestion-item:hover,
    .suggestion-item.is-active {
        background-color: var(--tan1);
        color: var(--gray8);
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

const buttonStyle = css`
    flex: 1 1 auto;
    background-color: var(--tan5);
    color: white;
    font-weight: normal;
    transition: background-color 0.3s ease;
    text-align: center;
    padding: 0.5em 1em;
    width: 120px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
`;

// Groups candidates by party, ordered per PARTIES constant
function groupCandidatesByParty(candidates) {
    const activeCandidates = candidates.filter(c => c.status === 'active')
    const groups = []
    for (const partyInfo of PARTIES) {
        const matches = activeCandidates.filter(c => c.party === partyInfo.key)
        if (matches.length > 0) {
            groups.push({ partyInfo, candidates: matches })
        }
    }
    return groups
}

// Strips protocol for display: "https://example.com/path" -> "example.com/path"
function displayUrl(url) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function normalizeRaceSlug(value) {
    if (!value) return null
    const str = String(value).toLowerCase()
    const match = str.match(/^(us-house|psc)-0*(\d+)$/)
    if (!match) return str
    return `${match[1]}-${Number(match[2])}`
}

function LegislativeCandidateBlock({ district, label, legislatureUrl }) {
    if (!district) return null

    const inCycleValue = district ? (district.in_cycle_2026 ?? district.in_cycle_2024) : undefined
    const isOutOfCycle = inCycleValue === 'no'

    return <div css={legeBlockStyle}>
        <h4>{legislatureUrl ? <a href={legislatureUrl} style={{ color: 'inherit', textDecoration: 'underline' }}>{label}</a> : label}</h4>
        {isOutOfCycle ? (
            <div className="out-of-cycle">
                This seat is not up for election in 2026.
                {district.holdover_senator && (
                    <span> Sen. {district.holdover_senator} will continue to represent this district.</span>
                )}
            </div>
        ) : (
            groupCandidatesByParty(district.candidates).map(({ partyInfo, candidates }) => (
                <div className="party-group" key={partyInfo.key}>
                    <div className="party-label" style={{ color: partyInfo.color }}>
                        {ELECTION_MODE === 'primary' ? `${partyInfo.noun}s` : partyInfo.noun}:
                    </div>
                    {candidates.map(c => (
                        <div className="candidate-row" key={c.slug}>
                            <span className="candidate-name">{c.displayName}</span>
                            {c.campaignWebsite && (
                                <span className="candidate-website">
                                    — <a href={c.campaignWebsite} target="_blank" rel="noopener noreferrer">
                                        {displayUrl(c.campaignWebsite)}
                                    </a>
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            ))
        )}
        {!isOutOfCycle && district.candidates.filter(c => c.status === 'active').length === 0 && (
            <div className="out-of-cycle">No candidates filed.</div>
        )}
    </div>
}

export default function AddressLookup({
    selDistricts,
    setSelDistricts,
    legislativeRaces,
    races,
}) {
    const router = useRouter();
    const { usHouse, psc, mtHouse, mtSenate, matchedAddress } = selDistricts;
    const [value, setValue] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const showSuggestions = suggestionsOpen && suggestions.length > 0;
    const activeDescendantId =
        highlightedIndex >= 0
            ? `${SUGGESTION_OPTION_ID_PREFIX}-${highlightedIndex}`
            : undefined;

    useEffect(() => {
        const query = (value || '').trim();
        if (query.length < MIN_SUGGEST_CHARS) {
            setSuggestions([]);
            setSuggestionsOpen(false);
            setHighlightedIndex(-1);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            try {
                const nextSuggestions = await districtFinder.suggestAddresses(query, {
                    maxLocations: 6,
                    signal: controller.signal,
                });
                setSuggestions(nextSuggestions);
                setSuggestionsOpen(nextSuggestions.length > 0);
                setHighlightedIndex(-1);
            } catch (err) {
                if (err?.name !== 'AbortError') {
                    setSuggestions([]);
                    setSuggestionsOpen(false);
                    setHighlightedIndex(-1);
                }
            }
        }, SUGGEST_DEBOUNCE_MS);

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [value]);

    function handleChange(event) {
        const input = event.target.value;
        setValue(input);
        setError(null);
        setSuggestionsOpen(true);
        setHighlightedIndex(-1);
    }

    function selectSuggestion(selectedAddress) {
        setValue(selectedAddress);
        setSuggestionsOpen(false);
        setHighlightedIndex(-1);
        setError(null);
    }

    function handleInputKeyDown(event) {
        if (!suggestions.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSuggestionsOpen(true);
            setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSuggestionsOpen(true);
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
            return;
        }

        if (event.key === 'Escape') {
            setSuggestionsOpen(false);
            setHighlightedIndex(-1);
            return;
        }

        if (event.key === 'Enter' && showSuggestions && highlightedIndex >= 0) {
            event.preventDefault();
            selectSuggestion(suggestions[highlightedIndex]);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (!(value || '').trim()) {
            setError('Please enter an address.');
            return;
        }

        setLoading(true);
        setSuggestionsOpen(false);
        setHighlightedIndex(-1);
        districtFinder.matchAddressToDistricts(
            value,
            match => {
                setSelDistricts(match);
                setError(null);
                setValue(match.matchedAddress || value);
                setLoading(false);
            },
            err => {
                setError('No Montana address match found. Please enter a valid Montana address, like 1301 E 6th Ave, Helena.');
                setLoading(false);
            }
        );
    }

    function reset() {
        setSelDistricts({
            usHouse: null,
            psc: null,
            mtHouse: 'HD-1',
            mtSenate: 'SD-1',
            matchedAddress: null
        });
        setValue(null);
        setError(null);
        setSuggestions([]);
        setSuggestionsOpen(false);
        setHighlightedIndex(-1);
    }

    const activeRaceSlugs = useMemo(
        () => new Set((races || []).map(r => normalizeRaceSlug(r.raceSlug))),
        [races]
    );

    const mappedDistricts = {
        usHouse: mapDistrictCode(selDistricts.usHouse),
        psc: mapDistrictCode(selDistricts.psc),
        mtHouse: mapDistrictCode(selDistricts.mtHouse),
        mtSenate: mapDistrictCode(selDistricts.mtSenate)
    };

    const usHouseSlug = normalizeRaceSlug(selDistricts.usHouse);
    const pscSlug = normalizeRaceSlug(selDistricts.psc);
    const usHouseActive = !!usHouseSlug && activeRaceSlugs.has(usHouseSlug);
    const pscActive = !!pscSlug && activeRaceSlugs.has(pscSlug);
    const guideRoot = `${router.basePath}/`;
    const usHouseUrl = usHouseActive ? `${guideRoot}#${usHouseSlug}` : null;
    const pscUrl = pscActive ? `${guideRoot}#${pscSlug}` : null;
    const legislatureUrl = `${guideRoot}#montana-legislature`;

    // Look up matched legislative districts from the full dataset
    const selHouseDistrict = useMemo(
        () => legislativeRaces ? legislativeRaces.find(d => d.districtKey === selDistricts.mtHouse) : null,
        [legislativeRaces, selDistricts.mtHouse]
    );
    const selSenateDistrict = useMemo(
        () => legislativeRaces ? legislativeRaces.find(d => d.districtKey === selDistricts.mtSenate) : null,
        [legislativeRaces, selDistricts.mtSenate]
    );

    return (
        <div css={lookupStyle}>
            <div className="ledein">Show only candidates for your voting address</div>
            <form onSubmit={handleSubmit}>
                <div className="input-wrap">
                    <input
                        onChange={handleChange}
                        onKeyDown={handleInputKeyDown}
                        onFocus={() => {
                            if (suggestions.length > 0) {
                                setSuggestionsOpen(true);
                            }
                        }}
                        onBlur={() => {
                            setSuggestionsOpen(false);
                            setHighlightedIndex(-1);
                        }}
                        type="text"
                        value={value || ''}
                        placeholder={PLACEHOLDER}
                        autoComplete="off"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showSuggestions}
                        aria-controls={SUGGESTIONS_LIST_ID}
                        aria-activedescendant={activeDescendantId}
                    />
                    {showSuggestions && (
                        <ul id={SUGGESTIONS_LIST_ID} className="suggestions-list" role="listbox">
                            {suggestions.map((suggestion, index) => {
                                const optionId = `${SUGGESTION_OPTION_ID_PREFIX}-${index}`;
                                const isActive = index === highlightedIndex;
                                return (
                                    <li
                                        id={optionId}
                                        key={`${suggestion}-${index}`}
                                        className={`suggestion-item${isActive ? ' is-active' : ''}`}
                                        role="option"
                                        aria-selected={isActive}
                                        onMouseDown={event => event.preventDefault()}
                                        onClick={() => selectSuggestion(suggestion)}
                                    >
                                        {suggestion}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                <button type="submit" disabled={loading} css={buttonStyle}>
                    {loading ? 'Searching...' : 'Look up'}
                </button>
                <div className="form-note">Suggestions are limited to Montana addresses.</div>
            </form>
            <div className="message">
                {error && (
                    <div css={errorStyle}>
                        <strong>Error:</strong> {error}
                    </div>
                )}
                {(matchedAddress === null && !error) && <div>{DEFAULT_MESSAGE}</div>}
                {(matchedAddress !== null && !error) && (
                    <div css={resultsContainerStyle}>
                        <div css={headerStyle}>
                            <div css={headerTitleStyle}>Districts for <strong>{matchedAddress}</strong>:</div>
                        </div>
                        <div css={topRowStyle}>
                            <div css={distResStyle}>
                                {usHouseActive && usHouseUrl
                                    ? <a href={usHouseUrl}>{mappedDistricts.usHouse}</a>
                                    : <>{mappedDistricts.usHouse}<br /><small>(Not in cycle)</small></>}
                            </div>
                            <div css={distResStyle}>
                                {pscActive && pscUrl
                                    ? <a href={pscUrl}>{mappedDistricts.psc}</a>
                                    : <>{mappedDistricts.psc}<br /><small>(Not in cycle)</small></>}
                            </div>
                        </div>
                        <LegislativeCandidateBlock
                            district={selHouseDistrict}
                            label={mappedDistricts.mtHouse}
                            legislatureUrl={legislatureUrl}
                        />
                        <LegislativeCandidateBlock
                            district={selSenateDistrict}
                            label={mappedDistricts.mtSenate}
                            legislatureUrl={legislatureUrl}
                        />
                        <a onClick={reset} css={resetStyle}>Reset</a>
                    </div>
                )}
            </div>
        </div>
    );
}
