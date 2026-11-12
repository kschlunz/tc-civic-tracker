/**
 * Look for recent local news coverage of what commissioners said or did
 * outside meetings and add it to src/data/statements.json.
 *
 *   npm run statements
 *   npm run statements -- --since 2026-09-01
 *
 * Needs ANTHROPIC_API_KEY. Writes statements-report.md for the pull request.
 */
import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORY_IDS } from "../src/lib/schema";
import { seatedOn, todayISO } from "../src/lib/roster";
import type { StoredStatement } from "../src/lib/types";
import { resolveModel } from "./lib/claude";
import { CATEGORY_LABELS } from "./lib/extraction";
import { mergeStatements, searchWindowStart } from "./lib/statements";
import { ROOT, loadRoster, loadStatements, saveStatements } from "./lib/store";

const { values } = parseArgs({ options: { since: { type: "string" } } });

async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local or the environment.");
  }
  const today = todayISO();
  const existing = loadStatements();
  const since = values.since ?? searchWindowStart(existing, today);
  const commissioners = loadRoster().filter((r) => seatedOn(r, since) || seatedOn(r, today));
  const model = resolveModel();
  const client = new Anthropic({ maxRetries: 4 });
  console.log(`Searching for coverage of ${commissioners.map((c) => c.name).join(", ")} from ${since} to ${today}...`);

  // Step 1: research with web search. Free text, so the model can report what it found and where.
  const tools = [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 12 }];
  const question = `Find local news coverage published between ${since} and ${today} that reports something a Transylvania County, North Carolina commissioner said or did in their public role outside the board's regular meetings: an announcement, a quoted position on a county issue, a candidacy or resignation, an appointment, a statement to a reporter. The commissioners are: ${commissioners.map((c) => c.name).join(", ")}.

Good sources are the Transylvania Times, Blue Ridge Public Radio, the Asheville Citizen-Times, WLOS and the county's own news page. Search for each commissioner by name as well as for the board as a whole.

For each item, give the commissioner, the publication, the publication date, the exact URL of the article as it appeared in your search results, and one or two neutral sentences on what the article reports the commissioner said or did. Report only what the article itself states. Leave out coverage of ordinary meeting votes (those are tracked separately), opinion pieces and letters to the editor, and anything you could not open or confirm. If you find nothing in this period, say so.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const searchedUrls: string[] = [];
  let findings = "";
  for (let turn = 0; turn < 5; turn++) {
    const message = await client.messages.stream({ model, max_tokens: 32000, output_config: { effort: "medium" }, tools, messages }).finalMessage();
    for (const block of message.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        searchedUrls.push(...block.content.map((result) => result.url));
      }
      if (block.type === "text") findings += block.text;
    }
    if (message.stop_reason === "refusal") throw new Error("The model declined the search request.");
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }

  // Step 2: put the findings into the data format.
  const schema = z.object({
    statements: z.array(
      z.object({
        commissionerId: z.enum(commissioners.map((c) => c.id) as [string, ...string[]]),
        date: z.string().describe("Publication date, YYYY-MM-DD."),
        source: z.string().describe('Publication name, e.g. "Transylvania Times".'),
        text: z.string().describe("One or two neutral sentences on what the article reports."),
        url: z.string(),
        categories: z.array(z.enum(CATEGORY_IDS)),
      }),
    ),
  });
  const structured = await client.messages.parse({
    model,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(schema) },
    messages: [
      {
        role: "user",
        content: `Below are research notes on recent news coverage of Transylvania County commissioners. Convert each item that has a commissioner, a date and a URL into a record. Copy URLs and dates exactly; drop items missing any of them. Return an empty list if the notes report nothing.

Commissioner ids: ${commissioners.map((c) => `${c.id} = ${c.name}`).join("; ")}
Category ids: ${Object.entries(CATEGORY_LABELS).map(([id, label]) => `${id} = ${label}`).join("; ")}

Research notes:
${findings}`,
      },
    ],
  });
  if (!structured.parsed_output) throw new Error("Could not read the model's list of statements.");

  const found: StoredStatement[] = structured.parsed_output.statements
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && URL.canParse(s.url))
    .map((s) => ({ ...s, type: "news" as const }));

  // Search results are not always returned as separate blocks; only enforce the link check when they were.
  const result = mergeStatements({
    existing,
    found,
    commissionerIds: commissioners.map((c) => c.id),
    since,
    today,
    searchedUrls: searchedUrls.length > 0 ? searchedUrls : undefined,
  });

  const reportFile = path.join(ROOT, "statements-report.md");
  fs.rmSync(reportFile, { force: true });
  console.log(`Found ${found.length}, added ${result.added.length}, rejected ${result.rejected.length}.`);
  if (result.added.length === 0) return;

  saveStatements(result.merged);
  const name = (id: string) => commissioners.find((c) => c.id === id)?.name ?? id;
  const lines = [
    `Adds ${result.added.length} news item${result.added.length === 1 ? "" : "s"} found by ${model} with web search (${since} to ${today}). Please open each link and confirm the summary matches the article before merging.`,
    searchedUrls.length > 0 ? "" : "\n**Note:** the links could not be checked against the search results automatically this run, so check that each one opens.\n",
    ...result.added.map((s) => `- **${name(s.commissionerId)}** — ${s.date}, [${s.source}](${s.url}): ${s.text}`),
  ];
  if (result.rejected.length > 0) {
    lines.push("", "Left out:", ...result.rejected.map((r) => `- ${name(r.statement.commissionerId)}, ${r.statement.date}, ${r.statement.url ?? "no link"} — ${r.reason}`));
  }
  fs.writeFileSync(reportFile, lines.join("\n") + "\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
