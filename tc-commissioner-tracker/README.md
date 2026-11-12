# Transylvania County Commissioner Tracker

A civic accountability site that tracks what the Transylvania County (NC) Board of Commissioners does: every vote and how each commissioner voted, what each commissioner raised in meetings, public comment, and whether commitments made in meetings are followed through.

The record is built automatically from the county's official minutes and reviewed by a person before it is published.

## How it works

```
county posts minutes ──► daily job finds them ──► Claude extracts a record
                                                        │
                              second pass checks the record against the PDF
                                                        │
                         pull request with a summary and anything to check
                                                        │
                                   a person reviews and merges ──► site updates
```

- **Data lives in git.** Each meeting is one JSON file in `src/data/meetings/`. The roster, election card and public statements are in `src/data/` too. There is no database and the site needs no API keys.
- **Discovery.** `scripts/lib/county.ts` reads <https://www.transylvaniacounty.org/meetings>, the county's own list, for each meeting's date, minutes, agenda and video links. Links are never guessed.
- **Extraction.** The minutes PDF is sent to Claude with a strict output schema. A second request checks the draft against the PDF; if it finds errors the record is redone once. Anything still uncertain is listed in the pull request under "To check" and stored in the record's `extraction.warnings`.
- **Consistency checks.** Before anything is written, code checks that every person named was on the board and present, that roll calls match results, that the mover did not vote against their own motion, and that follow-up references are valid. `npm run data` repeats these checks on every build, so a bad hand edit fails CI.
- **Follow-ups.** Each meeting is shown the commitments still open from earlier meetings and reports which ones it resolved or advanced. That is why meetings are always processed in date order.

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. To run the ingestion scripts locally, copy `.env.local.example` to `.env.local` and add an [Anthropic API key](https://console.anthropic.com/).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` | Run or build the site |
| `npm test` | Unit tests for the scraper, validation, extraction flow, follow-ups, statements and digest |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run data` | Validate everything in `src/data` and rebuild the bundle the site imports (runs automatically before the commands above) |
| `npm run ingest -- --dry-run` | Show which minutes are new, without calling Claude |
| `npm run ingest` | Extract newly posted minutes (up to 3 per run) |
| `npm run ingest -- --date 2026-03-09` | Extract one meeting |
| `npm run ingest -- --force --since 2024-12-02` | Rebuild every meeting from a date, in order |
| `npm run statements` | Search local news for recent coverage of commissioners |
| `npm run digest` | Experimental: write a per-meeting email/RSS digest to `out/digest/` (nothing is sent) |

## Automation

Three GitHub Actions workflows live in `.github/workflows/`:

- **CI** — lint, typecheck, tests and build on every pull request.
- **Ingest minutes** — runs every morning. If the county has posted new minutes it opens a pull request. It waits while an earlier ingest pull request is still open. Run it by hand with "Rebuild" ticked to re-extract everything from a date.
- **Find public statements** — runs weekly and opens a pull request with new news items. Only links that the web search actually returned are kept.

One-time setup in the GitHub repository:

1. **Settings → Secrets and variables → Actions → New repository secret**: `ANTHROPIC_API_KEY`.
2. **Settings → Actions → General → Workflow permissions**: tick "Allow GitHub Actions to create and approve pull requests".
3. Optional: a repository variable `TRACKER_MODEL` to use a model other than `claude-opus-5-5`.

Then run **Ingest minutes** by hand once with "Rebuild" ticked to load every meeting since the current board was seated.

## Editing data by hand

- **A correction to a meeting**: edit its file in `src/data/meetings/` and open a pull request. CI validates it.
- **A follow-up's status**: edit `status` (and `resolution`, `resolvedMeetingId`, `resolvedDate` when closing it) on the item in the file of the meeting that raised it.
- **A change of board**: edit `src/data/commissioners.json`. Give a departing commissioner an `end` date on their term and add the new commissioner with a `start` date; update `roles` when the board elects a chair. Pages, filters and the extraction prompt all follow from this file.
- **Election card**: `src/data/election.json`. Fill in `winners` once results are certified.

## Project layout

```
app/                  pages (Next.js App Router)
src/components/       UI components and charts
src/lib/schema.ts     the shape of all data (shared by site and scripts)
src/data/             meetings, roster, election, statements
scripts/              ingestion pipeline (scripts/lib has the testable parts)
tests/                unit tests and saved copies of the county's meetings page
```

## Contributing

This is a community project and contributions are welcome: fixing errors in the record, improving the pipeline, or suggesting ideas.

## License

MIT
