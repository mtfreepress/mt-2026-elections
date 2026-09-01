# Apple News local preview bundles

These 21 directories are generated from `../apple-news-build/manifest.json`,
`../apple-news-build/articles/*.html`, and the image files in `../public/`. Each article directory
contains its own image assets, referenced with `bundle://` URLs, so News Preview does not need to fetch
images from the deployed website. The original upload-oriented HTML and templates are not changed.

## Use in News Preview

1. Open Apple's News Preview app and select a Mac, iPhone, or iPad target.
2. Drag one article directory below onto the News Preview drop area. You can also drag its `article.json` file.
3. Open **Window > Console** if Apple reports a validation or rendering problem.
4. Rebuild after changing the source HTML with `npm run build:apple-news-preview`.

News Preview loads one local article at a time. Links in these local bundles deliberately use the
existing public election-guide URLs, so clicking them tests link presentation but opens the website.
Native navigation between Apple News articles can only resolve after the target articles exist in an
Apple News channel. The untouched files in `../apple-news-build/templates/` retain the
`@@ARTICLE_URL:key@@` placeholders for that eventual publishing step.

## Bundles

- `apple-news-2026-montana-election-guide/` — The Montana Free Press 2026 Election Guide
- `apple-news-election-guide-troy-downing/` — Troy Downing: 2026 Montana Election Guide
- `apple-news-election-guide-seth-bodnar/` — Seth Bodnar: 2026 Montana Election Guide
- `apple-news-election-guide-sam-forstag/` — Sam Forstag: 2026 Montana Election Guide
- `apple-news-election-guide-patrick-mccracken/` — Patrick McCracken: 2026 Montana Election Guide
- `apple-news-election-guide-nick-sheedy/` — Nick Sheedy: 2026 Montana Election Guide
- `apple-news-election-guide-michael-d-eisenhauer/` — Michael D Eisenhauer: 2026 Montana Election Guide
- `apple-news-election-guide-kyle-austin/` — Kyle Austin: 2026 Montana Election Guide
- `apple-news-election-guide-kurt-alme/` — Kurt Alme: 2026 Montana Election Guide
- `apple-news-election-guide-kevin-hamm/` — Kevin Hamm: 2026 Montana Election Guide
- `apple-news-election-guide-jeff-pattison/` — Jeff Pattison: 2026 Montana Election Guide
- `apple-news-election-guide-dan-wilson/` — Dan Wilson: 2026 Montana Election Guide
- `apple-news-election-guide-brian-j-miller/` — Brian J Miller: 2026 Montana Election Guide
- `apple-news-election-guide-annie-bukacek/` — Annie Bukacek: 2026 Montana Election Guide
- `apple-news-election-guide-angeline-cheek/` — Angeline Cheek: 2026 Montana Election Guide
- `apple-news-election-guide-amy-eddy/` — Amy Eddy: 2026 Montana Election Guide
- `apple-news-election-guide-alani-bankhead/` — Alani Bankhead: 2026 Montana Election Guide
- `apple-news-election-guide-aaron-flint/` — Aaron Flint: 2026 Montana Election Guide
- `apple-news-2026-montana-house-candidates/` — 2026 Montana House Candidates by District
- `apple-news-2026-montana-senate-candidates/` — 2026 Montana Senate Candidates by District
- `apple-news-2026-montana-voting-information/` — How to Vote in Montana’s 2026 Election
