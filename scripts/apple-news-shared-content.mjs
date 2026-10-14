import { readFile } from "node:fs/promises";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import YAML from "yaml";

const guideURL = "https://projects.montanafreepress.org/election-guide-2026/";
const legislatureURL = `${guideURL}legislative-candidates-by-district/`;
const parties = { D: "Democratic", R: "Republican", I: "Independent", L: "Libertarian", NP: "Nonpartisan", N: "Nonpartisan" };
const mappedRaces = new Set(["us-senate", "us-house-1", "us-house-2", "psc-1", "psc-5"]);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function markdown(copy) {
  if (typeof copy !== "string" || !copy.trim()) throw new Error("Missing shared Apple News copy");
  // Use the same Markdown renderer as the website.
  return renderToStaticMarkup(React.createElement(Markdown, null, copy));
}

function link(url, label) {
  return `<a href="${escapeHTML(url)}">${escapeHTML(label)}</a>`;
}

export async function loadSharedContent(projectRoot) {
  const [text, voting, races, raceCopy] = await Promise.all([
    readFile(join(projectRoot, "inputs/content/text.yml"), "utf8"),
    readFile(join(projectRoot, "inputs/content/how-to-vote.md"), "utf8"),
    readFile(join(projectRoot, "src/data/overview-races.json"), "utf8"),
    readFile(join(projectRoot, "inputs/content/races.yml"), "utf8"),
  ]);
  return { text: YAML.parse(text), voting, races: JSON.parse(races), raceCopy: YAML.parse(raceCopy) };
}

export function renderSharedArticle(article, shared) {
  const { text, voting, races, raceCopy } = shared;
  const about = `<h2>About this project</h2>\n${markdown(text.overviewAboutThisProject)}`;
  if (article.key === "voting-info") {
    return `<p>${link(guideURL, "Election guide")}</p>\n${markdown(voting)}\n${about}\n<p>${link(guideURL, "Return to the election guide")}</p>`;
  }
  if (article.key !== "guide") throw new Error(`No shared renderer for ${article.key}`);
  if (!Array.isArray(races) || !races.length) throw new Error("Website race overview is empty; run the data pipeline first");

  const raceSections = races.map(race => {
    const copy = raceCopy.find(item => item.raceSlug === race.raceSlug);
    if (!copy) throw new Error(`Missing shared race copy for ${race.raceSlug}`);
    const map = mappedRaces.has(race.raceSlug)
      ? `<figure><img src="${guideURL}maps/${escapeHTML(race.raceSlug)}.webp" alt="${escapeHTML(`Map of ${copy.displayName}`)}"></figure>`
      : "";
    const candidates = race.candidates.map(candidate => `<li>${link(`${guideURL}candidates/${candidate.slug}/`, candidate.displayName)} — ${escapeHTML(parties[candidate.party] ?? candidate.party)}</li>`).join("\n");
    return `<h2>${escapeHTML(copy.displayName)}</h2>\n${markdown(copy.description)}\n${map}\n<ul>${candidates}</ul>`;
  }).join("\n");

  // Apple News presentation and web navigation stay separate from shared editorial copy.
  return `<figure><img src="${escapeHTML(article.featuredImage.publicUrl)}" alt="${escapeHTML(article.featuredImage.altText)}"></figure>
${markdown(text.overviewLedeIn)}
<p><strong>${link(guideURL, "Explore the full 2026 Montana Election Guide")}</strong> for candidate profiles and interactive tools. Voting information is included below.</p>
<h2>Find your races</h2>
<p>${link(guideURL, "Find your races in our interactive guide")}</p>
${raceSections}
<h2>Montana Legislature</h2>
${markdown(text.overviewLegislatureLedeIn)}
<p>${link(legislatureURL, "Montana House candidates by district")}</p>
<p>${link(legislatureURL, "Montana Senate candidates by district")}</p>
<h2>Voting information</h2>
${markdown(voting)}
<h2>Other ballot items</h2>
${markdown(text.overviewAlsoOnYourBallot)}
${about}`;
}
