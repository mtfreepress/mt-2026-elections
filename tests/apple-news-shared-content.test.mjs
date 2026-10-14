import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadSharedContent, renderSharedArticle } from "../scripts/apple-news-shared-content.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const shared = await loadSharedContent(root);
const manifest = JSON.parse(await readFile(new URL("../apple-news-build/manifest.json", import.meta.url), "utf8"));
const guide = manifest.articles.find(article => article.key === "guide");
const voting = manifest.articles.find(article => article.key === "voting-info");

test("Markdown edits flow into both FAQ copies without changing saved HTML", () => {
  const changed = { ...shared, voting: "### Updated question?\n\nNew **answer** with a [source](https://example.com/)." };
  for (const article of [guide, voting]) {
    const html = renderSharedArticle(article, changed);
    assert.match(html, /<h3>Updated question\?<\/h3>/);
    assert.match(html, /New <strong>answer<\/strong> with a <a href="https:\/\/example.com\/">source<\/a>/);
    assert.ok(!html.includes("Who runs Montana"));
  }
});

test("shared overview copy and processed candidate changes flow into the guide", () => {
  const changed = structuredClone(shared);
  changed.text.overviewLedeIn = "Updated introduction.";
  changed.text.overviewLegislatureLedeIn = "Updated legislature copy.";
  changed.text.overviewAlsoOnYourBallot = "Updated ballot copy.";
  changed.text.overviewAboutThisProject = "Updated credits.";
  changed.raceCopy[0].description = "Updated race description.";
  changed.races[0].candidates = [{ slug: "test-candidate", displayName: "Test & Candidate", party: "I" }];
  const html = renderSharedArticle(guide, changed);
  for (const copy of ["Updated introduction.", "Updated legislature copy.", "Updated ballot copy.", "Updated credits.", "Updated race description."]) {
    assert.ok(html.includes(copy));
  }
  assert.match(html, /candidates\/test-candidate\/">Test &amp; Candidate<\/a> — Independent/);
});

test("Apple News navigation and hierarchy survive shared copy rendering", () => {
  const html = renderSharedArticle(guide, shared);
  assert.match(html, /Find your races in our interactive guide<\/a>/);
  assert.match(html, /Explore the full 2026 Montana Election Guide<\/a>/);
  assert.match(html, /Montana House candidates by district<\/a><\/p>\s*<p><a href="https:\/\/projects.montanafreepress.org\/election-guide-2026\/legislative-candidates-by-district\/">Montana Senate candidates by district/);
  assert.match(html, /<h2>Voting information<\/h2>\s*<h3>/);
  assert.ok(!html.includes("Guide data last updated"));
  assert.ok(!html.includes("@@ARTICLE_URL:"));
  assert.equal((html.match(/<h2>About this project<\/h2>/g) ?? []).length, 1);
});
